// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ILiquidityVault {
    function reserve(bytes32 claimId, uint256 amount) external;
    function release(bytes32 claimId) external returns (uint256 amount);
    function payout(bytes32 claimId, address recipient, uint256 amount) external;
    function reservedByClaim(bytes32 claimId) external view returns (uint256);
}
