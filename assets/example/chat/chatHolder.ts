import { Holder } from '../../adapter/abstract/Holder';
import { IChatModel } from './chatAdapter';
import { chatitem } from './chatitem';
const { ccclass, property } = cc._decorator;
@ccclass
export class chatHolder extends Holder<IChatModel> {
    private _itemScript: chatitem;
    protected onCreated(): void {
        this._itemScript = this.node.getComponent(chatitem);
    }
    protected onVisible(): void {
        this._itemScript.show(this.data, this.view.viewIndex, this.adapter);
    }
    protected onDisable(): void {}
}
