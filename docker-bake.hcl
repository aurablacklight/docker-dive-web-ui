variable "REGISTRY" {
  default = "dive-inspector"
}

variable "TAG" {
  default = "latest"
}

group "default" {
  targets = ["backend", "frontend"]
}

target "backend" {
  context = "./backend"
  dockerfile = "Dockerfile"
  tags = ["${REGISTRY}-backend:${TAG}"]
  platforms = ["linux/amd64"]
}

target "frontend" {
  context = "./frontend"
  dockerfile = "Dockerfile"
  tags = ["${REGISTRY}-frontend:${TAG}"]
  platforms = ["linux/amd64"]
}
