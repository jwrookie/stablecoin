// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../../tools/AbstractPausable.sol";

contract FraxBond is ERC20Burnable, AbstractPausable {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    uint256 public constant genesis_supply = 100e18; // 2M FRAX (only for testing, genesis supply will be 5k on Mainnet). This is to help with establishing the Uniswap pools, as they need liquidity

    // The addresses in this array are added by the oracle and these contracts are able to mint frax
    address[] public bond_issuers_array;

    // Mapping is also used for faster verification
    mapping(address => bool) public bond_issuers;

    // Constants for various precisions
    uint256 private constant PRICE_PRECISION = 1e6;


    /* ========== MODIFIERS ========== */

    modifier onlyIssuers() {
        require(bond_issuers[msg.sender] == true, "Only bond issuers can call this function");
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor (
        string memory _name,
        string memory _symbol,
        address _operatorMsg
    ) ERC20(_name, _symbol) AbstractPausable(_operatorMsg){

    }


    // Used by issuers when user mints
    function issuer_mint(address m_address, uint256 m_amount) external onlyIssuers {
        super._mint(m_address, m_amount);
        emit FXBMinted(msg.sender, m_address, m_amount);
    }

    // Used by issuers when user redeems
    function issuer_burn_from(address b_address, uint256 b_amount) external onlyIssuers {
        super._burn(b_address, b_amount);
        emit FXBBurned(b_address, msg.sender, b_amount);
    }

    // Adds an issuer
    function addIssuer(address issuer_address) external onlyOwner {
        require(bond_issuers[issuer_address] == false, "Address already exists");
        bond_issuers[issuer_address] = true;
        bond_issuers_array.push(issuer_address);
    }

    // Removes an issuer 
    function removeIssuer(address issuer_address) external onlyOwner {
        require(bond_issuers[issuer_address] == true, "Address nonexistant");

        // Delete from the mapping
        delete bond_issuers[issuer_address];

        // 'Delete' from the array by setting the address to 0x0
        for (uint i = 0; i < bond_issuers_array.length; i++) {
            if (bond_issuers_array[i] == issuer_address) {
                bond_issuers_array[i] = address(0);
                // This will leave a null in the array and keep the indices the same
                break;
            }
        }
    }

    // Track FXB burned
    event FXBBurned(address indexed from, address indexed to, uint256 amount);

    // Track FXB minted
    event FXBMinted(address indexed from, address indexed to, uint256 amount);
}
