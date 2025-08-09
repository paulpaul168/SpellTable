# SpellTable Apache Proxy Deployment Guide

This guide explains how to deploy SpellTable using Apache as a reverse proxy, where the frontend is accessible at the root path (`/`) and the backend API is accessible at `/api/`.

## Architecture Overview

```
Internet → Apache (Port 443/80) → Docker Containers
                                    ├── Frontend (Port 3000) - Serves at /
                                    └── Backend (Port 8010) - Serves at /api/
```

## Prerequisites

1. **Apache with required modules:**
   ```bash
   sudo a2enmod proxy proxy_http proxy_wstunnel headers rewrite
   sudo systemctl reload apache2
   ```

2. **SSL Certificate** (Let's Encrypt recommended):
   ```bash
   sudo certbot --apache -d spelltable.paulhoeller.at
   ```

3. **Docker and Docker Compose** installed

## Deployment Steps

### 1. Deploy the Application

```bash
# Deploy using the updated configuration
./deploy.sh deploy docker-compose.prod.yml
```

The services will now run internally and be accessible only through Apache proxy.

### 2. Configure Apache

Copy the provided Apache configuration:

```bash
# Copy the configuration file
sudo cp apache-spelltable.conf /etc/apache2/sites-available/spelltable.paulhoeller.at.conf

# Enable the site
sudo a2ensite spelltable.paulhoeller.at.conf

# Test configuration
sudo apache2ctl configtest

# Reload Apache
sudo systemctl reload apache2
```

### 3. Verify Deployment

1. **Check Docker services:**
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

2. **Test internal connectivity:**
   ```bash
   # Test frontend
   curl http://localhost:3000
   
   # Test backend
   curl http://localhost:8010/health
   ```

3. **Test external access:**
   ```bash
   # Test frontend via proxy
   curl https://spelltable.paulhoeller.at
   
   # Test backend via proxy
   curl https://spelltable.paulhoeller.at/api/health
   ```

## Configuration Details

### Docker Compose Changes

The Docker Compose files have been updated to:

1. **Remove external port exposure** - Services only expose ports internally
2. **Update API URL** - Frontend now uses `/api` instead of `http://backend:8010`
3. **Maintain internal networking** - Services still communicate via Docker network

### Frontend Configuration

The frontend now uses relative URLs:
- `NEXT_PUBLIC_API_URL=/api` instead of `http://backend:8010`
- API calls will be made to `/api/endpoint` which Apache proxies to the backend

### Apache Proxy Rules

```apache
# Backend API routes
ProxyPass        /api/  http://localhost:8010/
ProxyPassReverse /api/  http://localhost:8010/

# Frontend routes
ProxyPass        /       http://localhost:3000/
ProxyPassReverse /       http://localhost:3000/
```

## Security Benefits

1. **No direct container exposure** - Services are not accessible from the internet
2. **Centralized SSL termination** - Apache handles all SSL/TLS
3. **Request filtering** - Apache can filter and log all requests
4. **Rate limiting** - Can be implemented at the Apache level

## Troubleshooting

### Common Issues

1. **Frontend can't connect to backend:**
   - Verify Apache proxy configuration
   - Check that both services are running: `docker compose ps`
   - Test internal connectivity: `curl http://localhost:8010/health`

2. **Apache proxy errors:**
   - Check Apache error logs: `sudo tail -f /var/log/apache2/spelltable.paulhoeller-error.log`
   - Verify modules are enabled: `apache2ctl -M | grep proxy`

3. **SSL certificate issues:**
   - Renew certificates: `sudo certbot renew`
   - Check certificate validity: `openssl x509 -in /etc/letsencrypt/live/spelltable.paulhoeller.at/fullchain.pem -text -noout`

### Useful Commands

```bash
# View application logs
./deploy.sh logs docker-compose.prod.yml

# Restart application
./deploy.sh restart docker-compose.prod.yml

# Check service status
./deploy.sh status docker-compose.prod.yml

# Apache status
sudo systemctl status apache2

# Apache configuration test
sudo apache2ctl configtest
```

## Maintenance

### Regular Tasks

1. **Update application:**
   ```bash
   git pull
   ./deploy.sh deploy docker-compose.prod.yml
   ```

2. **Renew SSL certificates:**
   ```bash
   sudo certbot renew
   sudo systemctl reload apache2
   ```

3. **Monitor logs:**
   ```bash
   # Application logs
   ./deploy.sh logs docker-compose.prod.yml
   
   # Apache logs
   sudo tail -f /var/log/apache2/spelltable.paulhoeller.log
   ```

### Backup Strategy

The production configuration includes volumes for data persistence. Regular backups should include:

1. **Application data volumes**
2. **Apache configuration**
3. **SSL certificates**
4. **Docker Compose files**

## Performance Considerations

1. **Enable Apache caching** for static assets
2. **Configure gzip compression** for better performance
3. **Monitor resource usage** of both Apache and Docker containers
4. **Consider load balancing** for high-traffic deployments

## Next Steps

1. **Set up monitoring** (e.g., Prometheus, Grafana)
2. **Configure automated backups**
3. **Implement rate limiting**
4. **Set up alerting** for service failures
