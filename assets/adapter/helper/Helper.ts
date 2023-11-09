import { Orientation } from "../enum/enum";

export class Helper {
    static xy(axis: Orientation) {
        return axis == Orientation.Horizontal ? "x" : "y"
    }
    static wh(axis: Orientation) {
        return axis == Orientation.Horizontal ? "width" : "height"
    }
    static isNumber(value: any) {
        return typeof value == "number" && !isNaN(value)
    }
}