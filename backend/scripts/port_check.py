import socket

COMMON_PORTS = [21, 22, 25, 53, 80, 110, 143, 443, 445, 587, 993, 995, 3306, 3389, 5432, 8080, 8443]


def run_port_check(target: str, ports=None, timeout: float = 0.5):
    scanned_ports = ports or COMMON_PORTS
    open_ports = []

    for port in scanned_ports:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(timeout)
                result = sock.connect_ex((target, port))
                if result == 0:
                    open_ports.append(port)
        except Exception:
            continue

    if open_ports:
        summary = f"Open ports found: {', '.join(map(str, open_ports))}"
    else:
        summary = "No open ports found"

    return {
        "target": target,
        "scanned_ports": scanned_ports,
        "open_ports": open_ports,
        "summary": summary,
    }
