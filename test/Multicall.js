const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const {BigNumber} = require('ethers');


 async function snapshotGasCost(x){
    const resolved = await x
    if ('deployTransaction' in resolved) {
        const receipt = await resolved.deployTransaction.wait()
        console.log(receipt.gasUsed.toNumber());
    } else if ('wait' in resolved) {
        const waited = await resolved.wait()
        console.log(waited.gasUsed.toNumber());
    } else if (BigNumber.isBigNumber(resolved)) {
        console.log(resolved.toNumber());
    }
}


describe('Multicall', async () => {
    const wallets = waffle.provider.getWallets()


    beforeEach('create multicall', async () => {
        const multicallTestFactory = await ethers.getContractFactory('TestMulticall')

        multicall = await multicallTestFactory.deploy()
    })

    it('revert messages are returned', async () => {
        await expect(
            multicall.multicall([multicall.interface.encodeFunctionData('functionThatRevertsWithError', ['abcdef'])])
        ).to.be.revertedWith('abcdef')
    })

    it('return data is properly encoded', async () => {
        const [data] = await multicall.callStatic.multicall([
            multicall.interface.encodeFunctionData('functionThatReturnsTuple', ['1', '2']),
        ])
        const {
            tuple: {a, b},
        } = multicall.interface.decodeFunctionResult('functionThatReturnsTuple', data)
        expect(b).to.eq(1)
        expect(a).to.eq(2)
    })

    describe('context is preserved', () => {
        it('msg.value', async () => {
            await multicall.multicall([multicall.interface.encodeFunctionData('pays')], {value: 3})
            expect(await multicall.paid()).to.eq(3)
        })

        it('msg.value used twice', async () => {
            await multicall.multicall(
                [multicall.interface.encodeFunctionData('pays'), multicall.interface.encodeFunctionData('pays')],
                {value: 3}
            )
            expect(await multicall.paid()).to.eq(6)
        })

        it('msg.sender', async () => {
            expect(await multicall.returnSender()).to.eq(wallets[0].address)
        })
    })

    it('gas cost of pay w/o multicall', async () => {
        await snapshotGasCost(multicall.pays({value: 3}))
    })

    it('gas cost of pay w/ multicall', async () => {
        await snapshotGasCost(multicall.multicall([multicall.interface.encodeFunctionData('pays')], {value: 3}))
    })
})
