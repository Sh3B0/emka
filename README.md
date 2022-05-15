# Final Project Report

> Ahmed Nouralla - a.shaaban@innopolis.university
>
> Igor Mpore - i.mpore@innopolis.university

## Idea

Deploying a web application (**Express** + **MongoDB**) with **Kubernetes** on **Azure**, following security best practices recommended by [Azure](https://docs.microsoft.com/en-us/azure/aks/concepts-security) and [Kubernetes](https://kubernetes.io/docs/tasks/administer-cluster/securing-a-cluster/).

## Application

- The application being deployed is a sample application showing user info and allows updating them.

- Data is being stored and retrieved from MongoDB.

- To test the application locally, simply run `docker-compose build && docker-compose up`, then navigate to http://localhost:3000

## Architecture

![diagram](./images/architecture.svg)

## K8s Configuration

Directory `kubernetes` contains all the yaml config files used below for deployment, here is a summary of what each file is responsible for.

- `webapp.yaml`: web app `Deployment` and `Service`, specifies the address of application image in the registry and the number of replicas required (2 is set).

- `mongo.yaml`: MongoDB `Deployment` and `Service`, with port forwarding and references to config and secret.

- `mongo-config.yaml`: MongoDB `ConfigMap` which specifies database URL.

- `mongo-secret.yaml`: MongoDB `Secret` which specifies database credentials.

- `cluster-issuer.yaml`: creates cluster issuer resource which represents Certificate Authorities (CAs) that generates signed cerficates.

- `app-ingress.yaml`: creates ingress routing configuration for the application deployments and the Ingress Controller IP address.  

## Deployment

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) and [docker](https://docs.docker.com/get-docker/) are used.

  ```bash
  # Login to Azure cli
  $ az login
  
  # Create a resource group
  $ az group create --name myResourceGroup --location westeurope
  
  # Create container registry (to store app image)
  $ az acr create --resource-group myResourceGroup --name sh3b0cr --sku Basic
  
  # Login to container registry
  $ az acr login --name sh3b0cr
  
  # Get AcrLoginServer name
  $ az acr list --resource-group myResourceGroup --query "[].{acrLoginServer:loginServer}" --output table
  
  # Tag app image with AcrLoginServer
  $ docker tag emka_app:v1 sh3b0cr.azurecr.io/emka_app:v1
  
  # Push app image to registry
  $ docker push sh3b0cr.azurecr.io/emka_app:v1
  
  # Deploy app to Azure Kubernetes Service
  $ az aks create \
      --resource-group myResourceGroup \
      --name myAKSCluster \
      --node-count 2 \
      --generate-ssh-keys \
      --attach-acr sh3b0cr
      
  # Install kubectl
  $ az aks install-cli
  
  # Connect to AKS Cluster using kubectl 
  $ az aks get-credentials --resource-group myResourceGroup --name myAKSCluster
  
  # Show nodes
  $ kubectl get nodes
  
  NAME                                STATUS   ROLES   AGE     VERSION
  aks-nodepool1-15508900-vmss000000   Ready    agent   4m33s   v1.22.6
  aks-nodepool1-15508900-vmss000001   Ready    agent   4m56s   v1.22.6
  
  # Apply k8s deployment
  $ cd kubernetes
  $ kubectl apply -f mongo-config.yaml
  $ kubectl apply -f mongo-secret.yaml
  $ kubectl apply -f mongo.yaml
  $ kubectl apply -f webapp.yaml
  
  # Show status
  $ kubectl get all
  
  NAME                                     READY   STATUS    RESTARTS   AGE
  pod/mongo-deployment-7875498c-6nkjt      1/1     Running   0          52m
  pod/webapp-deployment-5d9bd7f5b5-8q8dp   1/1     Running   0          52m
  pod/webapp-deployment-5d9bd7f5b5-k698x   1/1     Running   0          52m
  
  NAME                     TYPE           CLUSTER-IP     EXTERNAL-IP    PORT(S)        AGE
  service/kubernetes       ClusterIP      10.0.0.1       <none>         443/TCP        106m
  service/mongo-service    ClusterIP      10.0.246.166   <none>         27017/TCP      52m
  service/webapp-service   LoadBalancer   10.0.12.69     20.31.66.224   80:30100/TCP   52m
  
  NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
  deployment.apps/mongo-deployment    1/1     1            1           52m
  deployment.apps/webapp-deployment   2/2     2            2           52m
  
  NAME                                           DESIRED   CURRENT   READY   AGE
  replicaset.apps/mongo-deployment-7875498c      1         1         1       52m
  replicaset.apps/webapp-deployment-5d9bd7f5b5   2         2         2       52m
  
  ```

- Application was successfully deployed and is available at http://20.31.66.224

## Installing Ingress Controller and adding SSL certificate

### 1. Install HELM Package Manager

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```
### 2. Installing Ingress Controller

```bash
# Creating the namespace app 
kubectl create namespace app

# Add the Helm chart for Nginx Ingress
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install the Helm (v3) chart for nginx ingress controller
helm install app-ingress ingress-nginx/ingress-nginx \
     --namespace ingress \
     --create-namespace \
     --set controller.replicaCount=2 \                                
     --set controller.nodeSelector."beta\.kubernetes\.io/os"=linux \  
     --set defaultBackend.nodeSelector."beta\.kubernetes\.io/os"=linux


# Get the Ingress Controller public IP address
kubectl get services --namespace ingress

```

### 3. Enabling HTTPS in Kubernetes using Cert Manager and Lets Encrypt

```bash
# Create a namespace for Cert Manager
kubectl create namespace cert-manager

# Get the Helm Chart for Cert Manager
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install Cert Manager using Helm charts
helm install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --version v1.5.4 \
    --set installCRDs=true

# Check the created Pods
kubectl get pods --namespace cert-manager

```
### 4. Re-deploy everything in the app namespace
```
kubectl apply --namespace app -f webapp.yaml
kubectl apply --namespace app -f mongo-secret.yaml
kubectl apply --namespace app -f mongo-config.yaml
kubectl apply --namespace app -f mongo.yaml
kubectl apply --namespace app -f cluster-issuer.yaml
kubectl apply --namespace app -f app-ingress.yaml 
```
### 5. Checking status

```bash
kubectl get all --namespace app

NAME                                     READY   STATUS    RESTARTS   AGE
pod/mongo-deployment-7875498c-jdpr2      1/1     Running   0          57m
pod/webapp-deployment-7c8bc4bcfc-kt9sx   1/1     Running   0          57m
pod/webapp-deployment-7c8bc4bcfc-lv4mn   1/1     Running   0          57m

NAME                     TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)     AGE
service/mongo-service    ClusterIP   10.0.52.141   <none>        27017/TCP   99m
service/webapp-service   ClusterIP   10.0.83.254   <none>        80/TCP      99m

NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/mongo-deployment    1/1     1            1           101m
deployment.apps/webapp-deployment   2/2     2            2           101m

NAME                                           DESIRED   CURRENT   READY   AGE
replicaset.apps/mongo-deployment-7875498c      1         1         1       101m
replicaset.apps/webapp-deployment-7c8bc4bcfc   2         2         2       101m

```

```bash
kubectl get services --namespace ingress

NAME                                             TYPE           CLUSTER-IP    EXTERNAL-IP    PORT(S)                      AGE
app-ingress-ingress-nginx-controller             LoadBalancer   10.0.246.68   20.23.10.150   80:31327/TCP,443:32568/TCP   44m
app-ingress-ingress-nginx-controller-admission   ClusterIP      10.0.169.48   <none>         443/TCP                      44m


# Verify that the certificate was issued
kubectl describe cert tls-secret --namespace app

```
Since all the traffic are now through the ingress controller, the app ip adress was now changed to https://20.23.10.150.nip.io/ and the ingress controller takes care of the routing through the [app-ingress.yaml](./kubernetes/app-ingress.yaml) configuration.

![website](./images/website.png)

## Security Considerations

Almost all security aspects are managed by the cloud provider, here we demonstrate our understanding of the security measures taken.

### Application and Image Security

- When installing application dependencies with `npm install`, we made sure that no vulnerabilities were found in the used versions of the dependencies.
  - Docker provides `docker scan` addon which we can configure to run periodically to scan the image against vulnerability databases such as Snyk and alert on found issues.
  - Azure provides [Microsoft defender for containers](https://docs.microsoft.com/en-us/azure/defender-for-cloud/defender-for-containers-introduction) which provides a similar functionality.

- Database credentials are implemented using K8s secrets which are stored in `etcd`, the cloud provider ensures [encryption at rest](https://docs.microsoft.com/en-us/azure/aks/concepts-security#:~:text=Etcd%20store%20is%20fully%20managed%20by%20AKS%20and%20data%20is%20encrypted%20at%20rest%20within%20the%20Azure%20platform.) with a platform-managed key.
- HTTPS is configured to ensure connection security.

### Registry Security

- Application image is deployed to Azure Container Registry with RBAC configured to only allow the K8s cluster to pull the image.

  ![registry](./images/registry.png)

### Cluster Security

#### Worker nodes security

- As demonstrated above, **worker nodes use a private IP address range** that is not publicly accessible from the Internet. This ensures that individual nodes are not vulnerable to any remote attacks. The physical security of the nodes is ensured by the cloud provider.

#### Master server security

- **Public master API:** when creating the cluster we can use `--api-server-authorized-ip-ranges`  to restrict the range of IP address authorized to access the API.
- **Private master API:** a more secure [setup](https://docs.microsoft.com/en-us/azure/aks/private-clusters) would be to have a private master API; Communication with the API can then be done by establishing a VPN Tunnel, or using  `az aks command invoke` which allows invoking commands like `kubectl` remotely through Azure API without directly connecting to the cluster.

### OS security for nodes

- Worker nodes are running Linux servers with the latest security updates and patches.
- It’s the responsibility of the cloud provider to schedule nightly updates of the worker nodes with minimal disruption to the service.

### Network Security

- The private subnet where nodes are deployed should be isolated from any other subnets through firewalls. Network security group rules are automatically configured to achieve this.
- Extra capabilities such as DDoS protection and Azure firewall can also be configured to add enhanced protection.

### Auditing, Logging, and monitoring

- Application and cloud logs should be monitored with alerts configured to respond to any security incident.
- A third-party solution like prometheus could be used for this purpose. Azure also provides its own monitoring tool that allows querying logs.

