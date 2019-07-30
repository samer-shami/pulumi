import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// get the current stack reference
const env = pulumi.getStack();
const infra = new pulumi.StackReference(`Tokagowa_Shogun/ecsCluster/${env}`);

let listenerInternal = infra.getOutput("loadBalancerInternalName")
let listenerExternal = infra.getOutput("loadBalancerExternalName")

export class BGLEC2Service extends awsx.ecs.EC2Service {

    constructor(name: string,
                args: awsx.ecs.EC2ServiceArgs,
                demoArgs: BGLEC2ServiceArgs,
                opts?: pulumi.ComponentResourceOptions) {

        if (!args.taskDefinition && !args.taskDefinitionArgs) {
            throw new Error("Either [taskDefinition] or [taskDefinitionArgs] must be provided");
        }
        if (!demoArgs.envTier || !demoArgs.envName || !demoArgs.envType) {
            throw new Error("You must provide values for [demoArgs.envTier], [demoArgs.envName] and [demoArgs.envType]");
        }

        if (!demoArgs.paramStorePaths) {
            demoArgs.paramStorePaths = `/shared/regional/${demoArgs.envType} /shared/${demoArgs.envName}/${demoArgs.envType} /${demoArgs.envType}/${demoArgs.envName}/${demoArgs.envTier}`
        }

        let loadBalancer = listenerInternal
        if (demoArgs.isExternal && demoArgs.isExternal == true) {
            loadBalancer = listenerExternal
        }

        if (args.taskDefinitionArgs) {
            if (args.taskDefinitionArgs.container) {
                args.taskDefinitionArgs.container.logConfiguration = addContainerLogConfiguration()
                args.taskDefinitionArgs.container.mountPoints      = addContainerMountPoints(args.taskDefinitionArgs.container.mountPoints)
                args.taskDefinitionArgs.container.dockerLabels     = addContainerDockerLabels(demoArgs)
                args.taskDefinitionArgs.container.environment      = addContainerEnvironment(args.taskDefinitionArgs.container.environment, demoArgs)
            }
            // TODO: deal with the case of "containers"
            else if (args.taskDefinitionArgs.containers) {
                // XXXX
            }
        }

        const taskDefinition = args.taskDefinition ||
            new awsx.ecs.EC2TaskDefinition(name, args.taskDefinitionArgs!, opts);

        const cluster = args.cluster || awsx.ecs.Cluster.getDefault();
        const subnets = args.subnets || cluster.vpc.privateSubnetIds;

        super(name, {
            ...args,
            taskDefinition,
            subnets,
        });

        this.registerOutputs();
    }
}

export interface BGLEC2ServiceArgs {
    envTier: string
    envName: string
    envType: string
    paramStorePaths?: string
    isExternal?: boolean
}

function addContainerLogConfiguration(): aws.ecs.LogConfiguration {
    return {
        logDriver: "fluentd",
        options: {
            "fluentd-address": "localhost:24224",
            "tag": "docker.elasticsearch.aggregator",
            "labels": "EnvTier,EnvName,EnvType,com.amazonaws.ecs.cluster,com.amazonaws.ecs.container-name,com.amazonaws.ecs.task-arn,com.amazonaws.ecs.task-definition-family,com.amazonaws.ecs.task-definition-version",
            "fluentd-sub-second-precision": "true"
        }
    }
}

function addContainerDockerLabels(demoArgs: BGLEC2ServiceArgs): {[label: string]: string} {
    return {
        "EnvTier": demoArgs.envTier,
        "EnvName": demoArgs.envName,
        "EnvType": demoArgs.envType
    }
}

type BGLEC2ServiceMountPoints = aws.ecs.MountPoint[] | Promise<aws.ecs.MountPoint[]> | pulumi.OutputInstance<aws.ecs.MountPoint[]> | undefined

function addContainerMountPoints(mounts: BGLEC2ServiceMountPoints): BGLEC2ServiceMountPoints {
    if (mounts instanceof Array) {
        return mounts.concat({
            containerPath: "/mnt/logs",
            sourceVolume: "logs-volume",
            readOnly: false
        })
    }
    else {
        return mounts
    }
}

type BGLEC2ServiceEnvironment = awsx.ecs.KeyValuePair[] | Promise<awsx.ecs.KeyValuePair[]> | pulumi.OutputInstance<awsx.ecs.KeyValuePair[]> | undefined

function addContainerEnvironment(existingValues: BGLEC2ServiceEnvironment, demoArgs: BGLEC2ServiceArgs): BGLEC2ServiceEnvironment {
    // Only do this if instanceof aws.ecs.KeyValuePair[]
    if (existingValues instanceof Array) {
        existingValues.push(
            {
                name: "AWS_REGION",
                value: aws.getRegion().id
            },
            {
                name: "ENV_TIER",
                value: demoArgs.envTier
            },
            {
                name: "ENV_NAME",
                value: demoArgs.envName
            },
            {
                name: "ENV_TYPE",
                value: demoArgs.envType
            },
            {
                name: "SERVICE_NAME",
                value: `${demoArgs.envType}-${demoArgs.envName}-${demoArgs.envTier}`
            },
            {
                name: "SERVICE_TAGS",
                value: `EnvName:${demoArgs.envName},EnvTier:${demoArgs.envTier},EnvType:${demoArgs.envType}`
            }
        )

        if (demoArgs.paramStorePaths) {
            existingValues.push(
                {
                    name: "PARAM_STORE_PATHS_LOAD",
                    value: demoArgs.paramStorePaths
                }
            )
        }
    }

    return existingValues
}