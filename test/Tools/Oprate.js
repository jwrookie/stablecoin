const SetArray = async () => {
    let argumentsLength = arguments.length;
    let resultArray = new Array();

    if (0 === argumentsLength) {
        return Error("Invaild arguments!");
    }
    for (let i = 0; i < argumentsLength; i++) {
        resultArray.push(arguments[i]);
    }
    return resultArray;
}

module.exports = {
    SetArray
}