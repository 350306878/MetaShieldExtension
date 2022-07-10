/* eslint-disable func-names */
/* eslint-disable no-alert */
import React from 'react';
import { render } from 'react-dom';
import {
    Drawer, Button, Alert, notification, Col, Row
} from 'antd';
import { proxyClient } from './postMessage.js';
import DrawerDemo from './DrawerDemo';
import server from '../server/server';
import './ProxyEthereum.scss';

const dictionary = {
    '0x095ea7b3': 'approve',
    '0xa22cb465': 'setApprovalForAll',
    '0x0752881a': 'transfer',
    '0x42842e0e': 'safeTransferFrom',
    '0xb88d4fde': 'safeTransferFrom1'
};

export default class ProxyEthereum {
    constructor() {
        this.container = null;
        this.init();
    }

    isNotableAction(constList) {
        // 检查是否为关注的交易
        const notableActionList = ['approve', 'setApprovalForAll', 'transfer', 'safeTransferFrom', 'safeTransferFrom1'];
        if (typeof constList.method !== 'undefined') {
            if (constList.method === 'eth_sendTransaction') {
                const functionName = dictionary[constList.params[0].data.substring(0, 10)];
                if (notableActionList.includes(functionName)) {
                    return { result: true, action: functionName };
                }
            }
        }
        return { result: false };
    }

    getDrawerType(domainVerificationData) {
        if (domainVerificationData.domain.status === 'whitelist') {
            return 'success';
        } if (domainVerificationData.domain.status === 'blacklist') {
            return 'danger';
        }
        return 'warning';
    }

    getAssetValue(constList) {
        return `${(parseInt(constList.params[0].value, 16) / (10 ** 18)).toFixed(4)} ETH`;
    }

    postMessageToContentScript(contractAddress) {
        console.log('start posting message');
        const msg = { msg_key: 'network_request', value: contractAddress };
        proxyClient.postMsg(msg);
    }

    renderDrawer(type, verification, contractAddress, domain, constList, actionName, assetValue) {
        this.showContainer();
        render(
            <DrawerDemo
                style={{ width: '50%' }}
                type={type}
                contractAddress={contractAddress}
                actionName={actionName}
                assetValue={assetValue}
                domain={domain}
                verification={verification}
                method={constList.method}
                params={constList.params}
                onClose={() => {
                    this.hideContainer();
                }}
            />,
            this.container
        );
    }

    initEthereumProxy() {
        const that = this;
        // 初始化代理
        const handler = {
            async apply(target, thisArg, argumentsList) {
                const constList = [...argumentsList][0];
                console.log('Transaction Method Data :>> ', constList);
                const isNotable = that.isNotableAction(constList).result;
                const actionName = that.isNotableAction(constList).action;
                if (isNotable) {
                    const contractAddress = constList.params[0].to;
                    // 获取一级域名
                    const domain = document.domain.split('.').slice(-2).join('.');
                    // 检查合约和域名安全性
                    const domainVerificationData = await that.verifyContractAndDomain({
                        contractAddress,
                        domain
                    });
                    that.postMessageToContentScript(contractAddress);
                    const contractVerificationData = await proxyClient.listenRequest();
                    const checkVerificationStatus = (domainVfData, contractVfData) => {
                        if (domainVfData.status
                            && domainVfData.status === 'success'
                            && contractVfData.msg.includes('success')) {
                            return true;
                        }
                        return false;
                    };
                    // console.log('domainVerificationData :>> ', domainVerificationData);
                    // console.log('contractVerificationData :>> ', contractVerificationData);

                    if (checkVerificationStatus(domainVerificationData, contractVerificationData)) {
                        const verification = {
                            contract: {
                                ...(contractVerificationData.params)
                            },
                            domain: {
                                ...domainVerificationData
                            }
                        };
                        console.log('verification :>> ', verification);
                        const type = that.getDrawerType(domainVerificationData.data);
                        const assetValue = actionName === 'transfer' ? that.getAssetValue(constList) : 0;
                        // 获取验证信息，渲染消息框
                        that.renderDrawer(type, verification, contractAddress, domain, constList, actionName, assetValue);
                        if (type === 'success') {
                            return target(...argumentsList);
                        }
                        // 监听用户选择
                        const decisionData = await proxyClient.listenDecision();
                        if (decisionData.value === 'continue') {
                            return target(...argumentsList);
                        }
                        return null;
                    }
                    // 检查合约和域名安全性时出错
                    const type = 'error';
                    that.renderDrawer(type, 'verification', 'contractAddress', domain, constList, actionName);
                }
                return target(...argumentsList);
            }
        };
        // eslint-disable-next-line no-use-before-define
        const proxyInterval = setInterval(proxyETH(), 1000);
        function proxyETH() {
            console.log('window.web3 :>> ', window.web3);
            if (typeof window.ethereum !== 'undefined') {
                console.log('Found ethereum');
                const proxy1 = new Proxy(window.ethereum.request, handler);
                window.ethereum.request = proxy1;
                clearInterval(proxyInterval);
            } else if (typeof window.web3 !== 'undefined') {
                console.log('Found web3');
                const proxy2 = new Proxy(window.web3.currentProvider, handler);
                window.web3.currentProvider = proxy2;
                clearInterval(proxyInterval);
            } else {
                console.log('Did not find ethereum or web3');
            }
        }
        setTimeout(() => { clearInterval(proxyInterval); }, 10000);
    }

    // 封装 fetch 请求： 检验合约和域名安全性
    verifyContractAndDomain({ contractAddress, domain }) {
        return server.postVerification(contractAddress, domain);
    }

    async test() {
        // const contractAddress = '0x4d224452801aced8b2f0aebe155379bb5d594381';
        // const domain = window.location.hostname;
        // if (domain.includes('tencent')) {
        //     this.renderDrawer('danger', mockData.data, '0x4d224452801aced8b2f0aebe155379bb5d594381', domain, cl);
        // } else if (domain.includes('google')) {
        //     this.renderDrawer('warning', mockData.data, '0x4d224452801aced8b2f0aebe155379bb5d594381', domain, cl);
        // } else if (domain.includes('github')) {
        //     this.renderDrawer('success', mockData.data, '0x4d224452801aced8b2f0aebe155379bb5d594381', domain, cl);
        // }

        // console.log('postMessageToContentScript');
        // this.postMessageToContentScript('0x4d224452801aced8b2f0aebe155379bb5d594381');
        // await proxyClient.listenRequest();
    }

    init() {
        this.initContainer();
        this.initEthereumProxy();
        // this.test();
        // 注意，必须设置了run_at=document_start 此段代码才会生效
        // document.addEventListener('DOMContentLoaded', () => {
        //     // this.initContainer();
        //     // this.initMessageClient();
        // });
    }

    // 初始化外层包裹元素
    initContainer() {
        const { document } = window;
        const base = document.querySelector(
            '#chrome-extension-content-base-element-ethereum'
        );
        if (base) {
            this.container = base;
        } else {
            this.container = document.createElement('div');
            this.container.setAttribute(
                'id',
                'chrome-extension-content-base-element-ethereum'
            );
            this.container.setAttribute('class', WRAPPER_CLASS_NAME);
            document.body.appendChild(this.container);
        }
    }

    showContainer() {
        const contentStyle = 'position: fixed; top: 0; left: 0; display: block; width: 100%; height: 10%; z-index: 9999;';
        document.querySelector('#chrome-extension-content-base-element-ethereum').setAttribute('style', contentStyle);
        // const contentStyle = 'display: block;';
        // document.querySelector('#chrome-extension-content-base-element-ethereum').setAttribute('style', contentStyle);
    }

    hideContainer() {
        const contentStyle = 'position: fixed; top: 0; left: 0; display: none; width: 100%; height: 10%; z-index: 9999;';
        document.querySelector('#chrome-extension-content-base-element-ethereum').setAttribute('style', contentStyle);
        // const contentStyle = 'display: none;';
        // document.querySelector('#chrome-extension-content-base-element-ethereum').setAttribute('style', contentStyle);
    }
}
