import socket
import ssl

COMMON_PORTS = [21, 22, 25, 53, 80, 110, 143, 443, 445, 587, 993, 995, 3306, 3389, 5432, 8080, 8443]

PORT_SERVICE_MAP = {
    21: "ftp",
    22: "ssh",
    25: "smtp",
    53: "dns",
    80: "http",
    110: "pop3",
    143: "imap",
    443: "https",
    445: "smb",
    587: "smtp-submission",
    993: "imaps",
    995: "pop3s",
    3306: "mysql",
    3389: "rdp",
    5432: "postgresql",
    8080: "http-alt",
    8443: "https-alt",
}


def recv_text(sock, size=256):
    try:
        data = sock.recv(size)
        return data.decode("utf-8", errors="ignore").strip() or None
    except Exception:
        return None


def detect_http_banner(host: str, port: int, timeout: float = 1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            request = f"HEAD / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
            sock.sendall(request.encode())
            response = recv_text(sock, 512)
            if not response:
                return None, "low"

            first_line = response.splitlines()[0] if response.splitlines() else ""
            return first_line, "medium"
    except Exception:
        return None, "low"


def detect_https_banner(host: str, port: int, timeout: float = 1.5):
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=timeout) as raw_sock:
            with context.wrap_socket(raw_sock, server_hostname=host) as tls_sock:
                request = f"HEAD / HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n"
                tls_sock.sendall(request.encode())
                response = recv_text(tls_sock, 512)
                if not response:
                    return "TLS service detected", "medium"

                first_line = response.splitlines()[0] if response.splitlines() else "TLS service detected"
                return first_line, "medium"
    except Exception:
        return None, "low"


def detect_ssh_banner(host: str, port: int, timeout: float = 1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            banner = recv_text(sock, 256)
            if banner and "SSH" in banner.upper():
                return banner, "high"
            return banner, "medium" if banner else ("SSH port open", "medium")
    except Exception:
        return None, "low"


def detect_smtp_banner(host: str, port: int, timeout: float = 1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            banner = recv_text(sock, 256)
            if banner:
                return banner, "high"
            return "SMTP port open", "medium"
    except Exception:
        return None, "low"


def generic_banner_grab(host: str, port: int, timeout: float = 1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            banner = recv_text(sock, 256)
            if banner:
                return banner, "medium"
            return None, "low"
    except Exception:
        return None, "low"


def fingerprint_service(host: str, port: int):
    guessed_service = PORT_SERVICE_MAP.get(port, "unknown")

    if port in (80, 8080):
        banner, confidence = detect_http_banner(host, port)
    elif port in (443, 8443, 993, 995):
        banner, confidence = detect_https_banner(host, port)
    elif port == 22:
        banner, confidence = detect_ssh_banner(host, port)
    elif port in (25, 587):
        banner, confidence = detect_smtp_banner(host, port)
    else:
        banner, confidence = generic_banner_grab(host, port)

    return {
        "port": port,
        "service": guessed_service,
        "banner": banner,
        "confidence": confidence,
    }


def run_port_check(target: str, ports=None, timeout: float = 0.5):
    scanned_ports = ports or COMMON_PORTS
    findings = []

    for port in scanned_ports:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(timeout)
                result = sock.connect_ex((target, port))
                if result == 0:
                    fingerprint = fingerprint_service(target, port)
                    findings.append(fingerprint)
        except Exception:
            continue

    open_ports = [item["port"] for item in findings]

    if findings:
        services_text = ", ".join(f'{item["port"]}/{item["service"]}' for item in findings)
        summary = f"Open services found: {services_text}"
    else:
        summary = "No open ports found"

    return {
        "target": target,
        "scanned_ports": scanned_ports,
        "open_ports": open_ports,
        "findings": findings,
        "summary": summary,
    }
