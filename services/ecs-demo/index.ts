import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// get the current stack reference
const env = pulumi.getStack();
const infra = new pulumi.StackReference(`Tokagowa_Shogun/ecs-service/${env}`);


let ecrService = new infra.BGLEC2Service(
    "ecs-demo",
    {
        desiredCount: 2,
        deploymentMinimumHealthyPercent: 50,
        deploymentMaximumPercent: 100,
        healthCheckGracePeriodSeconds: 30,
        taskDefinitionArgs: {
            container: {
                name: "ecs-demo",
                cpu: 128,
                memory: 512,
                portMappings: {
                    containerPort: 80,
                    protocol: "tcp"
                }
            }
        }
    },
    {
        envTier: "ecs-demo",
        envName: "demo",
        envType: "dev"
    }
)