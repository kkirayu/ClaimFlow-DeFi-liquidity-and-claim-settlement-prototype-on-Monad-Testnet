// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only token that attempts to re-enter the vault when tokens are transferred out.
contract ReentrantToken is ERC20 {
    address public vault;
    bool public attack;

    constructor() ERC20("Reentrant Token", "RNT") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setVault(address vault_) external {
        vault = vault_;
    }

    function setAttack(bool enabled) external {
        attack = enabled;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        if (attack && vault != address(0) && from == vault) {
            attack = false;
            (bool ok, bytes memory data) =
                vault.call(abi.encodeWithSignature("withdraw(uint256)", 1));
            if (!ok) {
                assembly {
                    revert(add(data, 32), mload(data))
                }
            }
        }
    }
}
