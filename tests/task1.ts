function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function execute(payload: any): Promise<any> {
    console.log('execution of task with payload: ' + JSON.stringify(payload));
    await timeout(5000*Math.random());
    if (Math.random() < 0.001) {
        console.log('ERROR')
        throw new Error('System error');
    }
    return payload;
}
export default execute;