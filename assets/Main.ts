/*
 * @Author: HanYaJun
 * @Date: 2023-11-08 20:16:23
 * @Email: hanyajun@wedobest.com.cn
 * @Description: 主界面加载
 */

import * as cc from 'cc';
import { VirtualList } from './scripts/virtualList/VirtualList';

const trace = function (...args) {
    console.log("Main【HYJ】", ...args);
}
const traceError = function (...args) {
    console.error("Main【HYJ】", ...args);
}

const { ccclass, property } = cc._decorator;

@ccclass('Main')
export class Main extends cc.Component {
    /**
     * @description: 当附加到一个激活的节点上或者其节点第一次激活时候调用
     * @return {*}
     */
    protected onLoad(): void {
        let buttons: cc.Button[] = this.node.getComponentsInChildren(cc.Button);
        buttons.forEach((button) => {
            button.node.on('click', this.btnClickCallBack, this);
        });
        this.initData();
        // cc.resources.load('prefab/layoutItem', cc.Prefab, (error, prefab) => {
        //     for (let i = 0; i < 6; i++) {
        //         const newNode: cc.Node = cc.instantiate(prefab);
        //         let layout: cc.Node = this.node.getChildByName('layout');
        //         layout.addChild(newNode);
        //     }
        // });
    }

    /**
     * @description: 初始化数据
     * @return {*}
     */
    private initData(): void {
        this.node.getChildByName('main').active = true;
        this.node.getChildByName('hor').active = false;
        this.node.getChildByName('ver').active = false;
    }

    /**
     * @description: 点击事件
     * @param {cc} button
     */
    private btnClickCallBack(button: cc.Button) {
        switch (button.node.name) {
            case 'horBtn': {
                // 水平滚动
                this.node.getChildByName('main').active = false;
                this.node.getChildByName('hor').active = true;
                this.node.getChildByName('ver').active = false;
                this.horizontalScrolling();
                break;
            };
            case 'VerBtn': {
                // 垂直滚动
                this.node.getChildByName('main').active = false;
                this.node.getChildByName('hor').active = false;
                this.node.getChildByName('ver').active = true;
                this.verticalScrolling();
                break;
            }
            case 'verBackBtn': {

            }
            case 'horBackBtn': {
                this.node.getChildByName('main').active = true;
                this.node.getChildByName('hor').active = false;
                this.node.getChildByName('ver').active = false;
                break;
            }
            default: {
                break;
            }
        }
    }

    /**
     * @description: 水平滚动
     * @return {*}
     */
    private horizontalScrolling(): void {
        let scrollViewData: number[] = [];
        for (let i = 0; i < 10; i++) {
            scrollViewData.push(i);
        }
        let hor: cc.Node = this.node.getChildByName('hor');
        const virScrollView: VirtualList = hor.getChildByName('horScrollView').getComponent(VirtualList);
        virScrollView.initData({ data: scrollViewData, clickCallback: (index) => { } }, 2);
        virScrollView.horScrollToIndex(0, 1);
    }

    /**
     * @description: 垂直滚动
     * @return {*}
     */
    private verticalScrolling(): void {
        let scrollViewData: number[] = [];
        for (let i = 0; i < 10; i++) {
            scrollViewData.push(i);
        }
        // const scrollViewData: number[] = new Array(30).fill(1);
        let hor: cc.Node = this.node.getChildByName('ver');
        const virScrollView: VirtualList = hor.getChildByName('verScrollView').getComponent(VirtualList);
        virScrollView.initData({ data: scrollViewData, clickCallback: (index) => { } });
        virScrollView.verScrollToIndex(0, 1);
    }
}

