pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./YourToken.sol";

contract Vendor is Ownable {

  YourToken immutable yourToken;
  uint256 public constant tokensPerEth = 100;

  event BuyTokens(address buyer, uint256 amountOfETH, uint256 amountOfTokens);

  constructor(address tokenAddress) public {
    yourToken = YourToken(tokenAddress);
  }

  function buyTokens() external payable {
    uint256 amount = msg.value*tokensPerEth;
    yourToken.transfer(msg.sender, amount);
    emit BuyTokens(msg.sender, msg.value, amount);
  }

  function sellTokens(uint256 amount) external {
    yourToken.transferFrom(msg.sender, address(this), amount);
    uint256 ethAmount = amount/tokensPerEth;
    payable(msg.sender).transfer(ethAmount);
  }

  function withdraw() external onlyOwner{
    payable(owner()).transfer(address(this).balance);
  }
}
