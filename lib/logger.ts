import util from 'util';

export function log(...args: any[]): void {
    console.log(util.format(...args));
};