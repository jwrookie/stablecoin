const {ethers} = require("hardhat");

async function main() {
    const account = await ethers.getSigners();

    let deployer = account[0];
    console.log("Deploy:\t" + deployer.address);

    let checkPermission = "0x87465916d6168fdC9f42B8649074B0EE361Eb061";
    let rusd = "0xc792dDbC43b0FB824D3B2916bb4BCa9dF113E9Ac";
    let tra = "0x707E9Dc22a38d7E14318Fea24EFe6848dd5D7bE9";
    let usdc = "0x1d870E0bDF106B8E515Ed0276ACa660c30a58D3A";
    let pool = "0x7Ca05dA8Fa3fa2EE8Fb4A7d257E2eEa7236C8310";
    let stableCoinPool = "0x9c35e3C876583E126D661e52AF5E0DF216aDCbAf";

    const AMOMinter = await ethers.getContractFactory('AMOMinter');
    let amoMinter = await AMOMinter.deploy(
        checkPermission,
        rusd,
        tra,
        usdc,
        stableCoinPool
    );
    console.log("AMOMinter:\t" + amoMinter.address);

    const ExchangeAMO = await ethers.getContractFactory('ExchangeAMO');
    let exchangeAMO = await ExchangeAMO.deploy(
        checkPermission,
        amoMinter.address,
        rusd,
        tra,
        usdc,
        pool,
        pool, // 3pool Lp address
        1,
        0
    );
    console.log("ExchangeAMO:\t" + exchangeAMO.address);
}

main()
    .then(() => console.log("Deploy Successfully!"))
    .catch((error) => {
        throw Error("Deploy fail! Error message:\t" + error);
    })