import { Button, Card, DatePicker, Divider, Input, List, Progress, Slider, Spin, Switch } from "antd";
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import Safe, { EthersAdapter, SafeFactory, SafeTransaction, TransactionOptions } from '@gnosis.pm/safe-core-sdk'
import SafeServiceClient from '@gnosis.pm/safe-service-client'
import { Address, Balance, EtherInput, AddressInput } from "../components";
import { usePoller, useLocalStorage, useBalance } from "../hooks";
import {EthSignSignature}  from './EthSignSignature'
export default function AdminView({
  purpose,
  userSigner,
  address,
  mainnetProvider,
  localProvider,
  yourLocalBalance,
  price,
  tx,
  readContracts,
  writeContracts,
  blockExplorer,
}) {
  const [to, setTo] = useState('')
  const [currentThreshold, setCurrentThreshold] = useState([])
  const [threshold, setThreshold] = useState(0)
  const [owners, setOwners] = useState([])
  const [transactions, setTransactions] = useState([])
  const [value, setValue] = useState(0)
  const [selector, setSelector] = useState('')
  const [params, setParams] = useState([])
  const [data, setData] = useState('0x0000000000000000000000000000000000000000')

  const OWNERS = ["0xCF3eBBCbFb77571145c86Cc39281b9433CD83Cd9", "0xD028d504316FEc029CFa36bdc3A8f053F6E5a6e4"]

  const THRESHOLD = 2

  const [safeAddress, setSafeAddress] = useLocalStorage("deployedSafe")

  const serviceClient = new SafeServiceClient('https://safe-transaction.rinkeby.gnosis.io/')

  const [ deploying, setDeploying ] = useState()

  const safeBalance = useBalance(localProvider, safeAddress);

  const [ ethAdapter, setEthAdapter ] = useState()
  useEffect(async () => {
    if(userSigner){
      setEthAdapter(new EthersAdapter({ ethers, signer: userSigner }))
    }
  },[ userSigner ]);

  usePoller(async () => {
    if(safeAddress){

      try{
        if(ethAdapter){
          const contract = await ethAdapter.getSafeContract(safeAddress)
          const owners = await contract.getOwners();
          const threshold = await contract.getThreshold();
          setOwners(owners)
          setThreshold(threshold)
          console.log("owners",owners,"threshold",threshold)
        }


        console.log("CHECKING TRANSACTIONS....",safeAddress)
        const transactions = await serviceClient.getPendingTransactions(safeAddress)
        //console.log("transactions",transactions)
        const currentThreshold = [];
        for (let i = 0; i < transactions.results.length; i++) {
          const signers = [];
          currentThreshold.push(transactions.results[i].confirmations.length)
          for (let j = 0; j < transactions.results[i].confirmations.length; j ++) {
            signers.push(transactions.results[i].confirmations[j].owner)
          }
          transactions.results[i].signers = signers;
        }

        setCurrentThreshold(currentThreshold)
        setTransactions(transactions.results)
      }catch(e){
        console.log("ERROR POLLING FROM SAFE:",e)
      }
    }
  },15000);



  let safeInfo
  if(safeAddress){
    safeInfo = (
      <div>
        <Address value={safeAddress} ensProvider={mainnetProvider} blockExplorer={blockExplorer} />
        <Balance value={safeBalance} price={price} />

        <div style={{padding:8}}>
        {owners?(
          <>
            <b>Signers:</b>
            <List
              bordered
              dataSource={owners}
              renderItem={item => {
                return (
                  <List.Item key={item + "_ownerEntry"}>
                    <Address address={item} ensProvider={mainnetProvider} fontSize={12} />
                  </List.Item>
                );
              }}
            />
          </>
        ):<Spin/>}

        </div>
      </div>
    )
  }else{
    safeInfo = (
      <div style={{padding:32}}>
        <Button loading={deploying} onClick={async ()=>{

          setDeploying(true)

          const safeFactory = await SafeFactory.create({ ethAdapter })
          const safeAccountConfig = { owners: OWNERS, threshold: THRESHOLD }
          const safe = await safeFactory.deploySafe(safeAccountConfig)

          setSafeAddress(safe.getAddress())
          setDeploying(false)

          console.log("SAFE",safe,safe.getAddress())

        }} type={"primary"} >
          DEPLOY SAFE
        </Button>
        <div> or enter existing address: </div>
        <AddressInput ensProvider={mainnetProvider} onChange={(addr)=>{
          if(ethers.utils.isAddress(addr)){
            console.log("addr!",addr)

            setSafeAddress(addr)
          }
        }}/>
      </div>
    )
  }



  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
        {safeAddress?<div style={{float:"right", padding:4, cursor:"pointer", fontSize:28}} onClick={()=>{
          setSafeAddress("")
        }}>
          x
        </div>:""}

        <div style={{padding:64}}>
          {safeInfo}
        </div>
        <h2>Result dependent payment</h2>



        <h2>Gnosis Transaction Initiation</h2>
        <h5>Enter Selector and Params only if the to address is a contract address</h5>
        <Divider />
        <div style={{ margin: 8 }}>
          <Input placeholder="Enter To Address"
            onChange={async (e) => {
              setTo(e.target.value)
            }}
          />
          <EtherInput
            autofocus
            price={price}
            placeholder="Enter Tx Value"
            onChange={value => {
              value = ethers.utils.parseEther(value.toString())
              setValue(value);
            }}
          />

          <Input placeholder="Enter Selector i.e add(uint, uint)"
            onChange={async (e) => {
              setSelector(e.target.value)
            }}
          />

          <Input placeholder="Enter arguments separated by ,"
            onChange={async (e) => {
              setParams(e.target.value.split(','))
            }}
          />
          <Button
            style={{ marginTop: 8 }}
            onClick={async () => {
              if (selector !== '' && params.length > 0) {
                const abi = [
                  "function " + selector
                ];
                const index = selector.indexOf('(');
                const fragment = selector.substring(0, index)

                const iface = new ethers.utils.Interface(abi);
                for (let i = 0; i < params.length; i++) {
                  if (iface.fragments[0].inputs[i].baseType.includes('uint') || iface.fragments[0].inputs[i].baseType.includes('int')) {
                    params[i] = parseInt(params[i])
                  }
                }
                const data = iface.encodeFunctionData(fragment, params);
                setData(data)
              }

              const id = await ethAdapter.getChainId()
              const contractNetworks = {
                [id]: {
                  multiSendAddress: safeAddress,
                  safeMasterCopyAddress: safeAddress,
                  safeProxyFactoryAddress: safeAddress
                }
              }

              const safeSdk = await Safe.create({ ethAdapter, safeAddress, contractNetworks })
              const nonce = await safeSdk.getNonce()
              const partialTx = {
                to,
                data,
                value: value.toString()
              }

              const safeTransaction = await safeSdk.createTransaction(partialTx)
              await safeSdk.signTransaction(safeTransaction)


              const hash = await safeSdk.getTransactionHash(safeTransaction)
              await serviceClient.proposeTransaction(safeAddress, safeTransaction.data,  hash, safeTransaction.signatures.get(address.toLowerCase()))
            }}
          >
            Sign Transaction
          </Button>

        </div>
      </div>
      <Divider />
      <div style={{ margin: 8 }}>
        {
          transactions.length > 0 && transactions.map((transaction, index) => (
            <div>
              <p>To: {transaction.to.substring(0, 6) + "......" + transaction.to.substring(transaction.to.length - 7, transaction.to.length - 1)}</p>
              <p>Data: {transaction.data.substring(0, 6) + "......" + transaction.data.substring(transaction.data.length - 7, transaction.data.length - 1)}</p>
              <p>Value: {transaction.value / 1e18} ETH</p>
              {owners.includes(address) && currentThreshold[index] >= threshold && <Button
                style={{ marginTop: 8 }}
                onClick={async () => {
                  const id = await ethAdapter.getChainId()
                  const contractNetworks = {
                    [id]: {
                      multiSendAddress: safeAddress,
                      safeMasterCopyAddress: safeAddress,
                      safeProxyFactoryAddress: safeAddress
                    }
                  }
                  const safeSdk = await Safe.create({ ethAdapter, safeAddress, contractNetworks })
                  const safeSdk2 = await safeSdk.connect({ ethAdapter, safeAddress })
                  console.log(transaction)

                  const safeTransactionData = {
                    to: transaction.to,
                    value: transaction.value,
                    data: transaction.data || '0x',
                    operation: transaction.operation,
                    safeTxGas: transaction.safeTxGas,
                    baseGas: transaction.baseGas,
                    gasPrice: Number(transaction.gasPrice),
                    gasToken: transaction.gasToken,
                    refundReceiver: transaction.refundReceiver,
                    nonce: transaction.nonce
                  }
                  const safeTransaction = await safeSdk.createTransaction(safeTransactionData)
                  if (transaction.confirmations) {
                    for(let i = 0; i < transaction.confirmations?.length; i++) {
                      const confirmation = transaction.confirmations[i]
                      const signature = new EthSignSignature(confirmation.owner, confirmation.signature)
                      await safeTransaction.addSignature(signature)
                    }
                  }
                  const executeTxResponse = await safeSdk2.executeTransaction(safeTransaction)
                  const receipt = executeTxResponse.transactionResponse && (await executeTxResponse.transactionResponse.wait())
                  console.log(receipt);
                }}>Execute TX</Button>}
              {owners.includes(address) && !transaction.signers.includes(address) && currentThreshold[index] < threshold && <Button
                style={{ marginTop: 8 }}
                onClick={async () => {
                  const id = await ethAdapter.getChainId()
                  const contractNetworks = {
                    [id]: {
                      multiSendAddress: safeAddress,
                      safeMasterCopyAddress: safeAddress,
                      safeProxyFactoryAddress: safeAddress
                    }
                  }
                  const safeSdk = await Safe.create({ ethAdapter, safeAddress, contractNetworks })
                  const hash = transaction.safeTxHash;
                  const signature = await safeSdk.signTransactionHash(hash);
                  await serviceClient.confirmTransaction(hash, signature.data)
                }}
              >
                Sign TX</Button>}
            </div>
          ))
        }
      </div>
      <div style={{padding:64,margin:64}}><a href="https://github.com/austintgriffith/scaffold-eth/tree/gnosis-starter-kit" target="_blank">🏗</a></div>
    </div>
  );
}
