const {LockerFirst, LockerSecond} = require("../Core/LibSourceConfig");
const {GetMap} = require("../Factory/StableAndMockFactory");

const LockerParametersCheck = async (tempArray) => {
    for (let i = 0; i < 3; i++) {
        switch (typeof tempArray[i]) {
            case "string":
                if (i === 2) {
                    throw Error("Locker: Need A Type Of Uint!");
                }
                break;
            case "number":
                if (i !== 2) {
                    throw Error("Locker: Need An Duration!");
                }
                break;
            default:
                throw Error("Locker: Invalid Type Of Parameters!");
        }
    }
}

const Locker = async (deployer, index = 1, contractConstructor = []) => {
    let tempMap = await GetMap();
    let locker;

    if ("object" !== typeof deployer || "{}" === JSON.stringify(deployer)) {
        throw Error("Locker: Invalid Deployer!");
    }

    if (0 === contractConstructor.length) {
        contractConstructor.push(tempMap.get("CHECKOPERA").address, tempMap.get("TRA").address, 86400);
        await LockerParametersCheck(contractConstructor);
    }else {
        await LockerParametersCheck(contractConstructor);
    }

    switch (index) {
        case 1:
            locker = await LockerFirst(deployer, contractConstructor);
            break;
        case 2:
            locker = await LockerSecond(deployer, contractConstructor);
            break;
    }

    return locker;
}

module.exports = {
    Locker
}
