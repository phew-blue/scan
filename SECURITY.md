# Security

## Reporting a vulnerability

Please open a GitHub issue or contact the maintainers directly. Do not include exploit details in public issues.

## Known considerations

### Access password stored as plaintext or bcrypt

`SCAN_ACCESS_PASSWORD` accepts either a plaintext password or a bcrypt hash. If a plaintext value is provided, the application will log a warning at startup. Use a bcrypt hash in production:

```bash
htpasswd -bnBC 12 "" yourpassword | tr -d ':\n'
```

### Session secret rotation

`SCAN_SESSION_SECRET` signs all session cookies. Rotating it (changing the value) will invalidate all active sessions, requiring users to log in again. Store it in a secret manager and keep it consistent across pod restarts.
