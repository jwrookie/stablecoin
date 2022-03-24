// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../AbstractPausable.sol";
import "../Frax.sol";
import "../../Staking/Owned.sol";

contract FRAXShares is ERC20Burnable, AbstractPausable {
    using SafeMath for uint256;

    address public FRAXStablecoinAdd;
    uint256 public constant GENESIS_SUPPLY = 100000000e18; // 100M is printed upon genesis
    address public oracle;
    FRAXStablecoin private frax;

    modifier onlyPools() {
        require(frax.isFraxPools(msg.sender) == true, "Only frax pools can mint new FRAX");
        _;
    }

    constructor (
        string memory _name,
        string memory _symbol,
        address _oracle
    ) public ERC20(_name, _symbol){
        require((_oracle != address(0)), "Zero address detected");
        oracle = _oracle;
        _mint(msg.sender, GENESIS_SUPPLY);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function setOracle(address new_oracle) external onlyOwner {
        require(new_oracle != address(0), "Zero address detected");
        oracle = new_oracle;
    }

    function setFraxAddress(address _address) external onlyOwner {
        require(_address != address(0), "Zero address detected");

        frax = FRAXStablecoin(_address);

        emit FRAXAddressSet(_address);
    }

    function mint(address to, uint256 amount) public onlyPools {
        _mint(to, amount);
    }

    // This function is what other frax pools will call to mint new FXS (similar to the FRAX mint) 
    function poolMint(address to, uint256 amount) external onlyPools {
        super._mint(to, amount);
        emit FXSMinted(address(this), to, amount);
    }

    // This function is what other frax pools will call to burn FXS 
    function poolBurnFrom(address _address, uint256 _amount) external onlyPools {
        super.burnFrom(_address, _amount);
        emit FXSBurned(_address, address(this), _amount);
    }

    /* ========== EVENTS ========== */

    // Track FXS burned
    event FXSBurned(address indexed from, address indexed to, uint256 amount);

    // Track FXS minted
    event FXSMinted(address indexed from, address indexed to, uint256 amount);

    event FRAXAddressSet(address addr);
}
