let id = 0;
export default (prefix: string) => { 
    return `${prefix}.t${++id}`;
}