/*
 * @Author: HanYaJun
 * @Date: 2023-10-18 14:37:25
 * @Email: hanyajun@wedobest.com.cn
 * @Description: 双向链表
 */

const trace = function (...args) {
    console.log("DoublyLinkedList【HYJ】", ...args);
}
const traceError = function (...args) {
    console.error("DoublyLinkedList【HYJ】", ...args);
}

/**
 * @description: 双向链表通过 LinkedNode 类来定义节点，每个节点包含元素值 value，指向前一个节点的指针 prev 和指向下一个节点的指针 next
 * @return {*}
 */
export class LinkedNode<T> {
    /**每个节点包含元素值 */
    public value: T = null;
    /**指向前一个节点的指针 */
    public prev: LinkedNode<T> = null;
    /**指向下一个节点的指针 */
    public next: LinkedNode<T> = null;

    constructor(value: T) {
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}

export class DoublyLinkedList<T> {
    /**头部元素 */
    private head: LinkedNode<T> = null;
    /**尾部元素 */
    private tail: LinkedNode<T> = null;
    /**链表的长度 */
    private length: number = null;

    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }

    /**
     * @description: 在链表尾部追加元素
     * @param {*} value 值
     * @return {*}
     */
    public tailAppend(value: T): void {
        const newLinkedNode: LinkedNode<T> = new LinkedNode<T>(value);

        if (!this.head) {
            this.head = newLinkedNode;
        } else {
            newLinkedNode.prev = this.tail;
            this.tail.next = newLinkedNode;
        }

        this.tail = newLinkedNode;
        this.length++;
    }

    /**
     * @description: 在链表头部追加元素
     * @param {T} value 值
     * @return {*}
     */
    public headAppend(value: T): void {
        const newLinkedNode: LinkedNode<T> = new LinkedNode<T>(value);

        if (!this.head) {
            this.head = newLinkedNode;
        } else {
            newLinkedNode.next = this.head;
            this.head.prev = newLinkedNode;
        }

        this.head = newLinkedNode;
        this.length++;
    }

    /**
     * @description: 遍历双向链表
     * @param {function} callbackfn
     * @param {any} thisArg
     * @return {*}
     */
    public forEach(callbackfn: (value: T, index: number, doublyLinkedList: DoublyLinkedList<T>) => void, thisArg?: any) {
        let currentNode: LinkedNode<T> = this.head;
        let index: number = 0;
        while (currentNode !== null) {
            callbackfn(currentNode.value, index, this);
            index++;
            currentNode = currentNode.next;
        }
    }

    /**
     * @description: 在指定位置插入元素
     * @param {number} position 位置索引
     * @param {T} value 值
     * @return {*}
     */
    public insert(position: number, value: T): boolean {
        if (position < 0 || position > this.length) {
            return false;
        }

        const newLinkedNode: LinkedNode<T> = new LinkedNode<T>(value);

        if (position === 0) {
            newLinkedNode.next = this.head;
            this.head.prev = newLinkedNode;
            this.head = newLinkedNode;
        } else if (position === this.length) {
            newLinkedNode.prev = this.tail;
            this.tail.next = newLinkedNode;
            this.tail = newLinkedNode;
        } else {
            let currentNode = this.head;
            for (let i = 0; i < position - 1; i++) {
                currentNode = currentNode.next;
            }

            newLinkedNode.prev = currentNode;
            newLinkedNode.next = currentNode.next;
            currentNode.next.prev = newLinkedNode;
            currentNode.next = newLinkedNode;
        }

        this.length++;
        return true;
    }

    /**
     * @description: 根据位置获取节点的值
     * @param {number} position 位置
     * @return {*}
     */
    public get(position: number): T {
        let index: number = this.indexJudge(position);
        if (index === null) {
            return null;
        }

        let middle: number = Math.floor(this.length / 2);
        let currentLinkedNode: LinkedNode<T> = null;
        if (index <= middle) {
            // 从头部开始遍历
            let currentNode: LinkedNode<T> = this.head;
            for (let i = 0; i < index; i++) {
                currentNode = currentNode.next;
            }
            currentLinkedNode = currentNode;
        } else {
            // 从尾部开始遍历
            let currentNode: LinkedNode<T> = this.tail;
            for (let i = this.length - 1; i > index; i--) {
                currentNode = currentNode.prev;
            }
            currentLinkedNode = currentNode;
        }

        return currentLinkedNode.value;
    }

    /**
     * @description: 根据值查找节点的位置
     * @param {T} value 值
     * @return {*}
     */
    public indexOf(value: T): number {
        let currentNode: LinkedNode<T> = this.head;

        for (let i = 0; i < this.length; i++) {
            if (currentNode.value === value) {
                return i;
            }
            currentNode = currentNode.next;
        }
        return -1;
    }

    /**
     * @description: 根据位置删除节点
     * @param {*} position 位置
     * @return {*}
     */
    public removeAt(position: number): T {
        let index: number = this.indexJudge(position);
        if (index === null) {
            return null;
        }

        let removedItem: T = null;

        if (index === 0) {
            removedItem = this.head.value;
            this.head = this.head.next;
            this.head.prev = null;
            if (this.length === 1) {
                this.tail = null;
            }
        } else if (index === this.length - 1) {
            removedItem = this.tail.value;
            this.tail = this.tail.prev;
            this.tail.next = null;
        } else {
            let currentNode: LinkedNode<T> = this.head;
            for (let i = 0; i < index; i++) {
                currentNode = currentNode.next;
            }

            removedItem = currentNode.value;
            currentNode.prev.next = currentNode.next;
            currentNode.next.prev = currentNode.prev;
        }

        this.length--;
        return removedItem;
    }

    /**
     * @description: 获取第一个值
     * @return {*}
     */
    public get First(): T {
        return this.get(0);
    }

    /**
     * @description: 获取最后一个值
     * @return {*}
     */
    public get Last(index: number): T {
        return this.get(this.length - 1);
    }

    /**
     * @description: 移除最后一者
     * @return {*}
     */
    public popLast(): T {
        return this.removeAt(-1);
    }

    /**
     * @description: 移除第一者
     * @return {*}
     */
    public popFirst(): T {
        return this.removeAt(0);
    }

    /**
     * @description: 索引值判断
     * @param {number} position
     * @return {*}
     */
    private indexJudge(position: number): number {
        let index: number = null;
        index = position >= 0 ? position : position + this.length;
        if (index < 0 || index >= this.length) {
            return null;
        }
        return index;
    }

    /**
     * @description: 根据值删除节点
     * @param {T} value 值
     * @return {*}
     */
    public remove(value: T): T {
        const position: number = this.indexOf(value);
        return this.removeAt(position);
    }

    /**
     * @description: 判断链表是否为空
     * @return {*}
     */
    public isEmpty(): boolean {
        return this.length === 0;
    }

    /**
     * @description: 获取链表长度
     * @return {*}
     */
    public size(): number {
        return this.length;
    }

    /**
     * @description: 清空链表
     */
    public clear(): void {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }
}





