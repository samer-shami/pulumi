import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// get the current stack reference
const env = pulumi.getStack();
const infra = new pulumi.StackReference(`Tokagowa_Shogun/basevpc/${env}`);
let vpc = awsx.ec2.Vpc.fromExistingIds("demo", { vpcId: infra.getOutput("vpcId")})

let loadBalancerInternalName = `demo-ecs-${env}-internal`.replace(/[^\w-]/g,"")
let loadBalancerExternalName = `demo-ecs-${env}-external`.replace(/[^\w-]/g,"")

const loadBalancerLogsS3BucketName = "samer.load-balancer.logs"

export const loadBalancerInternal = new awsx.elasticloadbalancingv2.ApplicationLoadBalancer(
    loadBalancerInternalName,
    {
        vpc: vpc,
        subnets: vpc.privateSubnetIds,
        accessLogs: {
            bucket:  loadBalancerLogsS3BucketName,
            enabled: true,
            prefix: loadBalancerExternalName,
        },
        enableDeletionProtection: true,
        external: true,
        idleTimeout: 240,
    }
)

export const loadBalancerExternal = new awsx.elasticloadbalancingv2.ApplicationLoadBalancer(
    loadBalancerExternalName,
    {
        vpc: vpc,
        subnets: vpc.publicSubnetIds,
        accessLogs: {
            bucket:  loadBalancerLogsS3BucketName,
            enabled: true,
            prefix: loadBalancerExternalName,
        },
        enableDeletionProtection: true,
        external: true,
        idleTimeout: 240,
    }
)

const ecsClusterName = `demo-${env}`
export let ecsCluster = new awsx.ecs.Cluster(
    ecsClusterName,
    {
        name: ecsClusterName,
        vpc: vpc,
    }
)

const ecsClusterASGName = `demo-${env}-ecs-ASG`
/*
const ecsClusterLaunchTemplateName = `demo-${env}-ecs-LT`
const ecsClusterLaunchTemplateInstanceType = "r5.large"
const ecsClusterLaunchTemplateImageId = aws.ssm.getParameter({name: "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"}).value
export const ecsClusterLaunchTemplate = new aws.ec2.LaunchTemplate(
    ecsClusterLaunchTemplateName,
    {
        name: ecsClusterLaunchTemplateName,
        imageId: ecsClusterLaunchTemplateImageId,
        instanceType: ecsClusterLaunchTemplateInstanceType,
    }
)

export const ecsClusterASG = new aws.autoscaling.Group(
    ecsClusterASGName,
    {
        name: ecsClusterASGName,
        minSize: 1,
        maxSize: 3,
        mixedInstancesPolicy: {
            instancesDistribution: {
                onDemandBaseCapacity: 1,
            },
            launchTemplate: {
                launchTemplateSpecification: {
                    launchTemplateId: ecsClusterLaunchTemplate.id,
                    launchTemplateName: ecsClusterLaunchTemplate.name,
                    version: "$Latest"
                }
            }
        },
        healthCheckGracePeriod: 300,
        healthCheckType: "EC2",
        terminationPolicies: [
            "OldestInstance",
            "OldestLaunchTemplate"
        ],
        enabledMetrics: [
            "GroupStandbyInstances", "GroupMaxSize", "GroupDesiredCapacity", "GroupMinSize", "GroupPendingInstances", "GroupTerminatingInstances", "GroupTotalInstances", "GroupInServiceInstances"
        ],
    }
)
*/
const awsxEcsClusterASG = new awsx.autoscaling.AutoScalingGroup(
    ecsClusterASGName,
    {
        vpc: vpc,
    }
)
ecsCluster.addAutoScalingGroup(awsxEcsClusterASG)
