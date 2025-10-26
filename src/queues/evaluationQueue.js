import Redis from 'ioredis';
import 'dotenv/config'
import { Queue } from 'bullmq';

const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
})

class EvaluationQueue  {
    constructor(){
        this.queue = new Queue("evaluation", {connection})
    }

    async addEvaluationJob(data){
        return await this.queue.add("evaluate", data, {
            attempts: 3,
            backoff: 5000,
        });
    }
}

export default new EvaluationQueue();