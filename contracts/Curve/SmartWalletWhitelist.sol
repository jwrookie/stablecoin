// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

import '@openzeppelin/contracts/access/Ownable.sol';

interface SmartWalletChecker {
    function check(address) external view returns (bool);
}

contract SmartWalletWhitelist is Ownable {

    mapping(address => bool) public wallets;
    address public checker;
    address public future_checker;

    event ApproveWallet(address);
    event RevokeWallet(address);

    constructor (address _owner)  {
        checker = address(0);
    }

    function commitSetChecker(address _checker) onlyOwner external {
        future_checker = _checker;
    }

    function applySetChecker() onlyOwner external {
        checker = future_checker;
    }

    function approveWallet(address _wallet) onlyOwner public {
        wallets[_wallet] = true;

        emit ApproveWallet(_wallet);
    }

    function revokeWallet(address _wallet) onlyOwner external {
        wallets[_wallet] = false;

        emit RevokeWallet(_wallet);
    }

    function check(address _wallet) external view returns (bool) {
        bool _check = wallets[_wallet];
        if (_check) {
            return _check;
        } else {
            if (checker != address(0)) {
                return SmartWalletChecker(checker).check(_wallet);
            }
        }
        return false;
    }
}