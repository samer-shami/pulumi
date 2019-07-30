import * as awsx from "@pulumi/awsx";
/**
 * This will create a vpc with the given cidrbloack and create public, private and isolated subnets /20 split accross 3 availabilty zones
 * we can overide the subnet block and specify a cidrmask. 
 */
export const vpc = new awsx.ec2.Vpc("demo",{
    numberOfAvailabilityZones: 2,
    cidrBlock: "10.190.0.0/16",
    subnets: [
        {type: "public",                         cidrMask: 21},
        {type: "isolated",                       cidrMask: 21},
        {type: "private",  name: "aws-managed",  cidrMask: 20},
        {type: "private",  name: "self-managed", cidrMask: 20},
      //{type: "private",  name: "spare",        cidrMask: 19},
    ],
    tags: {
        Name: "demo-testing",
        cost_center: "shared"
    }
})

//creating a global base-vpc-sg
const sg = new awsx.ec2.SecurityGroup("base-sg", {vpc})

// allow access from demo network
sg.createIngressRule("basevpc-ssh", {
    location: { cidrBlocks: [ "103.31.113.3/32" ] },
    ports: new awsx.ec2.TcpPorts(22),
    description: "allow SSH access to 103.31.113.3",
});

// outbound TCP traffic on any port to anywhere
sg.createEgressRule("outbound-access", {
    location: new awsx.ec2.AnyIPv4Location(),
    ports: new awsx.ec2.AllTcpPorts(),
    description: "allow outbound access to anywhere",
});


/**
 * exports the following variables
 * basevpc-sg: object:awsx.ec2.SecurityGroup
 * vpcId: Object:awsx:ec2.Vpc
 * vpcPrivatSubnetIds: String[]
 * vpcPublicSubnetIds: String[]
 * 
 */
export const baseSgObj = sg
export const vpcObj = vpc
export const vpcId = vpc.id
export const vpcPrivatSubnetIds = vpc.privateSubnetIds
export const vpcPublicSubnetIds = vpc.publicSubnetIds


