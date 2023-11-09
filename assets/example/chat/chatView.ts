import { View } from '../../adapter/abstract/View';
import { IViewElement } from '../../adapter/interface/interface';
import { IChatModel } from './chatAdapter';
const { ccclass, property } = cc._decorator;

@ccclass
export class chatView extends View<IChatModel> {
    protected setViewElement(element: IViewElement, data: IChatModel): void {
        element.minSize.height = 100
    }
    protected onVisible(): void {
    }
    protected onDisable(): void {
    }
}

