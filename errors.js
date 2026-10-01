export class JudgmentError extends Error {
    constructor(code, message) { super(message); this.name = 'JudgmentError'; this.code = code; }
}
