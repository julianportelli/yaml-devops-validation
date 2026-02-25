export class Dictionary<T> extends Map<string, T> {
    constructor(entries?: readonly (readonly [string, T])[] | null) {
        super(entries);
    }
}