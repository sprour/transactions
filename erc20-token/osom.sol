pragma solidity ^0.4.21;

library SafeMath {
    function add(uint a, uint b) internal pure returns (uint c) {
        c = a + b;
        require(c >= a);
    }
    function sub(uint a, uint b) internal pure returns (uint c) {
        require(b <= a);
        c = a - b;
    }
    function mul(uint a, uint b) internal pure returns (uint c) {
        c = a * b;
        require(a == 0 || c / a == b);
    }
    function div(uint a, uint b) internal pure returns (uint c) {
        require(b > 0);
        c = a / b;
    }
}

contract ERC20Interface {
    function totalSupply() public view returns (uint);
    function balanceOf(address tokenOwner) public view returns (uint balance);
    function allowance(address tokenOwner, address spender) public view returns (uint remaining);
    function transfer(address to, uint tokens) public returns (bool success);
    function approve(address spender, uint tokens) public returns (bool success);
    function transferFrom(address from, address to, uint tokens) public returns (bool success);

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}

contract osom is ERC20Interface{
    using SafeMath for uint;
    string public name;
    string public symbol;
    uint public decimals;
    uint public bonusEnds;
    uint public icoEnds;
    uint public icoStarts;
    uint public allContributers;
    uint allTokens;
    address admin;
    mapping(address => uint) public balances;
    mapping(address => mapping(address => uint)) allowed;

    function ICO() public {
        name = "Osom Coin";
        decimals = 18;
        symbol = "OSM";
        bonusEnds = now + 2 weeks;
        icoEnds = now + 6 weeks;
        icoStarts = now;
        allTokens = 100000000000000000000 * 100;
        admin = (msg.sender);
        balances[msg.sender] = allTokens;

    }

    // 100 OSM token = 1 Ether
    function buyTokens() public payable {
        uint tokens;
        if(now <= bonusEnds){
            tokens = msg.value.mul(125); // 25% bonus
        }else{
            tokens = msg.value.mul(100);
        }
        balances[msg.sender] = balances[msg.sender].add(tokens);
        allTokens = allTokens.add(tokens);
        Transfer(address(0), msg.sender, tokens);
        allContributers++;
    }

    function totalSupply() public constant returns (uint){
        return allTokens;
    }

    function myBalance() public constant returns (uint){
        return balances[msg.sender];
    }

    function myAddress() public constant returns (address){
        address myAddress = msg.sender;
        return myAddress;
    }

    function endSale() public {
        require(msg.sender == admin);
        admin.transfer(address(this).balance);
    }

    function balanceOf(address tokenOwner) public view returns (uint balance) {
        return balances[tokenOwner];
    }

    function transfer(address to, uint tokens) public returns (bool success) {
        balances[msg.sender] = balances[msg.sender].sub(tokens);
        balances[to] = balances[to].add(tokens);
        emit Transfer(msg.sender, to, tokens);
        return true;
    }

    function approve(address spender, uint tokens) public returns (bool success) {
        allowed[msg.sender][spender] = tokens;
        emit Approval(msg.sender, spender, tokens);
        return true;
    }

    function transferFrom(address from, address to, uint tokens) public returns (bool success) {
        balances[from] = balances[from].sub(tokens);
        allowed[from][msg.sender] = allowed[from][msg.sender].sub(tokens);
        balances[to] = balances[to].add(tokens);
        emit Transfer(from, to, tokens);
        return true;
    }

    function allowance(address tokenOwner, address spender) public view returns (uint remaining) {
        return allowed[tokenOwner][spender];
    }



}