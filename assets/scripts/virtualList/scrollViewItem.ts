/*
 * @Author: HanYaJun
 * @Date: 2023-11-09 16:42:04
 * @Email: hanyajun@wedobest.com.cn
 * @Description: 虚拟列表 item
 */

import * as cc from 'cc';
import { VirtualScrollViewClickCallback } from './VirtualList';

const trace = function (...args) {
    console.log("scrollViewItem【HYJ】", ...args);
}
const traceError = function (...args) {
    console.error("scrollViewItem【HYJ】", ...args);
}

const { ccclass, property } = cc._decorator;

@ccclass('scrollViewItem')
export class scrollViewItem extends cc.Component {
    /**索引 */
    private index: number = 0;
    /**自己的索引 */
    private selfIndex: number = 0;
    /**点击回调 */
    private clickCallback: VirtualScrollViewClickCallback = null;

    /**
     * @description: 当附加到一个激活的节点上或者其节点第一次激活时候调用
     * @return {*}
     */
    protected onLoad(): void {
        this.node.on(cc.Node.EventType.TOUCH_END, this.onHander, this);
    }

    /**
     * @description: 点击事件
     * @param {cc} event
     * @return {*}
     */
    private onHander(event: cc.EventTouch): void {
        const name: string = event.target.name;
    }

    /**
     * @description: 生命周期方法
     * @param {number} index
     * @param {*} data
     * @param {VirtualScrollViewClickCallback} clickCallback
     * @return {*}
     */
    public virtualScrollViewData(index: number, data: {}, clickCallback: VirtualScrollViewClickCallback) {
        this.index = index;
        this.clickCallback = clickCallback;
        this.node.getChildByName('itemLabel').getComponent(cc.Label).string = String(this.index);
    }
}

