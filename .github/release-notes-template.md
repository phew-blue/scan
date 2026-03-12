## Docker Image

```bash
ghcr.io/phew-blue/scan:${VERSION}
```

`latest` always points to the most recent stable release.

For production deployments, pin images to their digest — digests are appended to this release once the Docker build completes.

## Kubernetes (Flux + app-template)

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: scan
  namespace: default
spec:
  interval: 1h
  chartRef:
    kind: OCIRepository
    name: app-template
  values:
    controllers:
      main:
        containers:
          app:
            image:
              repository: ghcr.io/phew-blue/scan
              tag: ${VERSION}
            env:
              SCAN_DB_HOST: <postgres-host>
              SCAN_DB_NAME: scan
              SCAN_DB_USER: scan
              SCAN_DB_PASSWORD: <secret>
              SCAN_OIDC_ISSUER: https://<auth-host>
              SCAN_OIDC_CLIENT_ID: scan
              SCAN_OIDC_CLIENT_SECRET: <secret>
              SCAN_OIDC_REDIRECT_URL: https://<app-host>/auth/callback
```
