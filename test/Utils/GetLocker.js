const {Locker} = require("../Factory/LockerFactory");

const GetLocker = async (deploy, index = 1, contractConstructor = []) => {
    return await Locker(deploy, index, contractConstructor);
}

module.exports = {
    GetLocker
}