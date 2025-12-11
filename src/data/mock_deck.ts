export interface Card {
    id: string;
    front: string;
    back: string;
    status: 'new' | 'learning' | 'review' | 'done';
}

export const MOCK_DECK: Card[] = [
    {
        id: 'c1',
        front: 'Amazon Detective',
        back: 'Amazon Detective simplifies the process of analyzing, investigating, and identifying the root cause of potential security issues or suspicious activities. It automatically collects log data from your AWS resources and uses machine learning, statistical analysis, and graph theory to generate visualizations that help you conduct faster and more efficient security investigations.',
        status: 'new'
    },
    {
        id: 'c2',
        front: 'AWS Fargate',
        back: 'AWS Fargate is a serverless compute engine for containers that works with both Amazon Elastic Container Service (ECS) and Amazon Elastic Kubernetes Service (EKS). Fargate removes the need to provision and manage servers, lets you specify and pay for resources per application, and improves security through application isolation by design.',
        status: 'new'
    },
    {
        id: 'c3',
        front: 'DynamoDB Consistency Models',
        back: 'DynamoDB supports two consistency models: Eventually Consistent and Strongly Consistent. Eventually Consistent reads are the default and maximize your read throughput, but might not reflect the results of a recently completed write. Strongly Consistent reads return a result that reflects all writes that received a successful response prior to the read.',
        status: 'new'
    }
];
