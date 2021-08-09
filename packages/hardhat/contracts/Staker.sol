pragma solidity >=0.6.0 <0.7.0;

interface ExternalExampleContract {
	function complete() external payable;
}

contract Staker {
	mapping(address => uint256) public balances;
	uint256 public constant threshold = 1 ether;
	uint256 public deadline = now + 30 seconds;
	address immutable externalExampleContract;
	bool disableAndActivateWithdrawals = false;
	bool firstRun = true;

	event Stake(address staker, uint256 amount);

	constructor(address _externalExampleContract) public {
		externalExampleContract = _externalExampleContract;
	}

	modifier beforeDeadline() {
		require(timeLeft() > 0, "deadline not passed");
		_;
	}

	modifier afterDeadline() {
		require(timeLeft() == 0, "deadline is NOT passed");
		_;
	}

	modifier contractIsActive() {
		require(!disableAndActivateWithdrawals, "contract is disabled");
		_;
	}

	modifier contractIsDisabled() {
		require(disableAndActivateWithdrawals, "contract is active");
		_;
	}

	function stake() public payable contractIsActive {
		balances[msg.sender] += msg.value;
		require(balances[msg.sender] >= msg.value);
		emit Stake(msg.sender, msg.value);
	}

	function execute() public afterDeadline contractIsActive {
		if (address(this).balance >= threshold) {
			ExternalExampleContract(externalExampleContract).complete{
				value: address(this).balance
			}();
		} else if (firstRun) {
			disableAndActivateWithdrawals = true;
		}
		firstRun = false;
	}

	function withdraw(address payable to) public contractIsDisabled {
		require(balances[to] > 0);
		uint256 amount = balances[to];
		balances[to] = 0;
		payable(to).transfer(amount);
	}

	function timeLeft() public view returns (uint256) {
		return now < deadline ? deadline - now : 0;
	}
}
