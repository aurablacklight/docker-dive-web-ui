# Docker Dive Web UI Helm Chart

This Helm chart deploys the Docker Dive Web UI application on Kubernetes, with specific optimizations for AWS EKS and Kubernetes 1.30 compatibility.

## Prerequisites

- Kubernetes 1.25+
- Helm 3.8+
- For AWS EKS deployments:
  - AWS Load Balancer Controller
  - EBS CSI Driver
  - IAM Roles for Service Accounts (IRSA) configured

## Installation

### Basic Installation

```bash
helm install docker-dive-web-ui ./helm/docker-dive-web-ui
```

### AWS EKS Installation

1. First, create the necessary AWS resources:

```bash
# Create IAM role for IRSA (replace account ID and region)
aws iam create-role \
  --role-name docker-dive-web-ui-role \
  --assume-role-policy-document file://trust-policy.json

# Attach necessary policies
aws iam attach-role-policy \
  --role-name docker-dive-web-ui-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
```

2. Install with EKS-specific values:

```bash
helm install docker-dive-web-ui ./helm/docker-dive-web-ui \
  -f ./helm/docker-dive-web-ui/values-eks.yaml \
  --set aws.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"="arn:aws:iam::YOUR-ACCOUNT:role/docker-dive-web-ui-role"
```

## Configuration

### Core Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.frontend.repository` | Frontend image repository | `docker-dive-frontend` |
| `image.backend.repository` | Backend image repository | `docker-dive-backend` |
| `image.*.tag` | Image tag | `Chart.appVersion` |

### AWS EKS Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `aws.region` | AWS region | `us-west-2` |
| `aws.serviceAccount.create` | Create service account with IRSA | `true` |
| `aws.serviceAccount.annotations` | IRSA annotations | `{}` |
| `aws.ebs.enabled` | Enable EBS CSI StorageClass | `true` |
| `aws.loadBalancer.controller.enabled` | Use AWS Load Balancer Controller | `true` |

### Ingress Configuration (EKS)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class | `alb` |
| `ingress.annotations` | ALB-specific annotations | See values.yaml |

### Resource Management

| Parameter | Description | Default |
|-----------|-------------|---------|
| `resources.frontend.requests.cpu` | Frontend CPU requests | `100m` |
| `resources.frontend.requests.memory` | Frontend memory requests | `128Mi` |
| `resources.backend.requests.cpu` | Backend CPU requests | `500m` |
| `resources.backend.requests.memory` | Backend memory requests | `512Mi` |

### High Availability

| Parameter | Description | Default |
|-----------|-------------|---------|
| `autoscaling.enabled` | Enable HPA | `false` |
| `autoscaling.minReplicas` | Minimum replicas | `1` |
| `autoscaling.maxReplicas` | Maximum replicas | `10` |
| `podDisruptionBudget.enabled` | Enable PDB | `false` |

## AWS EKS Specific Features

### IAM Roles for Service Accounts (IRSA)

The chart supports IRSA for fine-grained AWS permissions:

```yaml
aws:
  serviceAccount:
    create: true
    annotations:
      eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/docker-dive-web-ui-role
```

### EBS CSI Driver Integration

Automatically creates optimized StorageClass for EBS volumes:

```yaml
aws:
  ebs:
    enabled: true
    storageClass:
      type: gp3
      encrypted: true
      iopsPerGB: 3
      throughput: 125
```

### AWS Load Balancer Controller

Optimized for ALB ingress with proper health checks:

```yaml
ingress:
  className: "alb"
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /api/health
```

### Node Targeting

Target specific EKS node groups:

```yaml
nodeSelector:
  eks.amazonaws.com/nodegroup: worker-nodes
  kubernetes.io/arch: amd64
```

### Multi-AZ High Availability

Automatic pod distribution across availability zones:

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        topologyKey: topology.kubernetes.io/zone
```

## Kubernetes 1.30 Compatibility

This chart is fully compatible with Kubernetes 1.30 and includes:

- Updated `autoscaling/v2` API for HorizontalPodAutoscaler
- Kubernetes 1.30 security contexts with `seccompProfile`
- Pod Security Standards compliance
- Updated health check configurations

## Security Features

### Pod Security Context

```yaml
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001
  seccompProfile:
    type: RuntimeDefault
```

### Network Policies

Optional network policies for ingress/egress control:

```yaml
networkPolicy:
  enabled: true
  policyTypes:
    - Ingress
    - Egress
```

## Monitoring

### Prometheus Integration

```yaml
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s
```

## Persistence

### EBS Persistent Storage

```yaml
persistence:
  enabled: true
  storageClass: "gp3"
  size: 10Gi
  annotations:
    ebs.csi.aws.com/encrypted: "true"
```

## Upgrading

To upgrade an existing installation:

```bash
helm upgrade docker-dive-web-ui ./helm/docker-dive-web-ui
```

## Uninstallation

```bash
helm uninstall docker-dive-web-ui
```

## Troubleshooting

### EKS Common Issues

1. **ALB not creating**: Ensure AWS Load Balancer Controller is installed
2. **IRSA not working**: Verify IAM role and trust policy
3. **Storage issues**: Check EBS CSI driver installation
4. **Pod scheduling**: Verify node selectors and taints

### Health Check Failures

The chart includes comprehensive health checks. If pods are failing:

1. Check the health endpoint: `kubectl port-forward svc/docker-dive-web-ui-backend 3000:3000`
2. Test health endpoint: `curl http://localhost:3000/api/health`

### Logs

View application logs:

```bash
kubectl logs -l app.kubernetes.io/name=docker-dive-web-ui -c docker-dive-web-ui-backend
kubectl logs -l app.kubernetes.io/name=docker-dive-web-ui -c docker-dive-web-ui-frontend
```

## Contributing

1. Make changes to the chart
2. Test with `helm template` and `helm lint`
3. Update this README if needed

## License

This chart is released under the MIT License.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.frontend.repository` | Frontend image repository | `dive-inspector-frontend` |
| `image.frontend.tag` | Frontend image tag | `latest` |
| `image.backend.repository` | Backend image repository | `dive-inspector-backend` |
| `image.backend.tag` | Backend image tag | `latest` |
| `image.frontend.pullPolicy` | Frontend image pull policy | `IfNotPresent` |
| `image.backend.pullPolicy` | Backend image pull policy | `IfNotPresent` |
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.frontend.port` | Frontend service port | `80` |
| `service.backend.port` | Backend service port | `3000` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.hosts[0].host` | Ingress hostname | `docker-dive-web-ui.local` |
| `resources.frontend.limits.cpu` | Frontend CPU limit | `100m` |
| `resources.frontend.limits.memory` | Frontend memory limit | `128Mi` |
| `resources.backend.limits.cpu` | Backend CPU limit | `500m` |
| `resources.backend.limits.memory` | Backend memory limit | `512Mi` |
| `dockerSocket.enabled` | Enable Docker socket access | `true` |
| `dockerSocket.hostPath` | Docker socket host path | `/var/run/docker.sock` |
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.size` | Persistent volume size | `1Gi` |
| `healthCheck.enabled` | Enable health checks | `true` |

## Example Configurations

### Basic Installation

```yaml
# values.yaml
replicaCount: 1
service:
  type: ClusterIP
dockerSocket:
  enabled: true
```

### Production Installation with Ingress

```yaml
# values-prod.yaml
replicaCount: 2

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
  hosts:
    - host: dive.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: dive-tls
      hosts:
        - dive.yourdomain.com

resources:
  frontend:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi
  backend:
    limits:
      cpu: 1
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 70
```

### Development Installation with NodePort

```yaml
# values-dev.yaml
service:
  type: NodePort
  frontend:
    port: 80
    nodePort: 30080
  backend:
    port: 3000
    nodePort: 30300

resources:
  frontend:
    limits:
      cpu: 50m
      memory: 64Mi
  backend:
    limits:
      cpu: 250m
      memory: 256Mi
```

## Usage

### Install the chart

```bash
helm install dive-ui ./helm/docker-dive-web-ui
```

### Upgrade the chart

```bash
helm upgrade dive-ui ./helm/docker-dive-web-ui
```

### Uninstall the chart

```bash
helm uninstall dive-ui
```

### Check status

```bash
helm status dive-ui
kubectl get pods -l app.kubernetes.io/name=docker-dive-web-ui
```

## Accessing the Application

After installation, follow the instructions shown in the NOTES to access your application:

1. **Port Forward (ClusterIP):**
   ```bash
   kubectl port-forward svc/dive-ui-docker-dive-web-ui-frontend 8080:80
   # Access at http://localhost:8080
   ```

2. **NodePort:**
   ```bash
   # Access at http://<node-ip>:<node-port>
   ```

3. **Ingress:**
   ```bash
   # Access at your configured domain
   ```

## Security Considerations

### Docker Socket Access

The backend requires access to the Docker socket to analyze images. This is achieved by mounting `/var/run/docker.sock` from the host. Consider the security implications:

- The backend container can access the Docker daemon
- Use appropriate RBAC and network policies
- Consider using a Docker-in-Docker sidecar for better isolation

### Production Recommendations

1. **Use specific image tags** instead of `latest`
2. **Enable resource limits** and requests
3. **Use ingress with TLS** for external access
4. **Implement proper RBAC** for service accounts
5. **Use network policies** to restrict traffic
6. **Enable monitoring** and logging

## Troubleshooting

### Common Issues

1. **Pods not starting:**
   ```bash
   kubectl describe pod <pod-name>
   kubectl logs <pod-name>
   ```

2. **Docker socket permission issues:**
   ```bash
   # Check if Docker socket is accessible
   kubectl exec -it <backend-pod> -- ls -la /var/run/docker.sock
   ```

3. **Service connectivity:**
   ```bash
   # Test backend health
   kubectl exec -it <frontend-pod> -- curl backend-service:3000/api/health
   ```

### Debug Commands

```bash
# Check all resources
kubectl get all -l app.kubernetes.io/name=docker-dive-web-ui

# Check persistent volumes
kubectl get pv,pvc

# Check ingress
kubectl get ingress

# View logs
kubectl logs -l app.kubernetes.io/component=backend
kubectl logs -l app.kubernetes.io/component=frontend
```

## Development

### Building Custom Images

To use your own Docker images:

1. Build the images:
   ```bash
   docker build -t your-registry/dive-frontend:v1.0.0 ./frontend
   docker build -t your-registry/dive-backend:v1.0.0 ./backend
   ```

2. Push to your registry:
   ```bash
   docker push your-registry/dive-frontend:v1.0.0
   docker push your-registry/dive-backend:v1.0.0
   ```

3. Update values.yaml:
   ```yaml
   image:
     frontend:
       repository: your-registry/dive-frontend
       tag: v1.0.0
     backend:
       repository: your-registry/dive-backend
       tag: v1.0.0
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `helm template` and `helm install --dry-run`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
