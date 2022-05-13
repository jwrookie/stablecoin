const {StableCoinPool,GetRusdAndTra,SetRusdAndTraConfig} = require("./Utils/GetStableConfig");
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetUniswap} = require("./Utils/GetUniswapConfig");
const {GetSigners} = require("./Utils/GetSigners");
const {ZEROADDRESS} = require("./Lib/Address");
const {GetConfigAboutCRV} = require("./Tools/Deploy");

contract('StableCoinPool', async function () {
    ZERO_ADDRESS = ZEROADDRESS;

    beforeEach(async function (){
        [owner, dev] = await GetSigners();

        [, operatable, rusd, tra] = await GetRusdAndTra();

        await SetRusdAndTraConfig(rusd, tra);

        [usdc] = await GetMockToken(1, [owner, dev]);

        stableCoinPool = await StableCoinPool(operatable, rusd, tra, usdc, 100000);

        [weth, factory] = await GetConfigAboutCRV(owner);

        await GetUniswap(owner, stableCoinPool, factory, usdc, weth, owner);
        await GetUniswap(owner, stableCoinPool, factory, rusd, weth, owner);
        await GetUniswap(owner, stableCoinPool, factory, tra, weth, owner);
    });

    it('test', async function () {
        // await rusd.refreshCollateralRatio();
        // await stableCoinPool.mintFractionalStable(1, 1, 1);
        // console.log(await stableCoinPool.getCollateralPrice());
    });
});