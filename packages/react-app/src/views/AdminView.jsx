import { Button, Divider, Input, List, Spin, InputNumber, Form } from "antd"
import React, { useState, useEffect } from "react"
import { ethers } from "ethers"
import Safe, { EthersAdapter, SafeFactory } from "@gnosis.pm/safe-core-sdk"
import SafeServiceClient from "@gnosis.pm/safe-service-client"
import { Address, Balance, EtherInput, AddressInput, BytesStringInput } from "../components"
import { usePoller, useLocalStorage, useBalance } from "../hooks"

export default function AdminView({ userSigner, address, mainnetProvider, localProvider, price, blockExplorer }) {
  const [to, setTo] = useState("")
  const [owners, setOwners] = useState([])
  const [value, setValue] = useState(0)
  const [data, setData] = useState("0x0000000000000000000000000000000000000000")
  const [newSafeOwners, setSafeNewOwners] = useState([])
  const [newSafeThreshold, setNewSafeThreshold] = useState(2)
  const [initialLoad, setInitialLoad] = useState(true)

  const [safeAddress, setSafeAddress] = useLocalStorage("deployedSafe")

  const serviceClient = new SafeServiceClient("https://safe-transaction.rinkeby.gnosis.io/")

  const [deploying, setDeploying] = useState()

  const safeBalance = useBalance(localProvider, safeAddress)

  const [ethAdapter, setEthAdapter] = useState()
  useEffect(async () => {
    if (userSigner) {
      setEthAdapter(new EthersAdapter({ ethers, signer: userSigner }))
    }
  }, [userSigner])

  usePoller(async () => {
    if (safeAddress) {
      setSafeAddress(ethers.utils.getAddress(safeAddress))
      try {
        if (ethAdapter) {
          const contract = await ethAdapter.getSafeContract(safeAddress)
          const owners = await contract.getOwners()
          const threshold = await contract.getThreshold()
          setOwners(owners)
          console.log("owners", owners, "threshold", threshold)
          setInitialLoad(false)
        }

        console.log("CHECKING TRANSACTIONS....", safeAddress)
        const transactions = await serviceClient.getPendingTransactions(safeAddress)
        //console.log("transactions",transactions)
        const currentThreshold = []
        for (let i = 0; i < transactions.results.length; i++) {
          const signers = []
          currentThreshold.push(transactions.results[i].confirmations.length)
          for (let j = 0; j < transactions.results[i].confirmations.length; j++) {
            signers.push(transactions.results[i].confirmations[j].owner)
          }
          transactions.results[i].signers = signers
        }

      } catch (e) {
        console.log("ERROR POLLING FROM SAFE:", e)
      }
    }
  }, 15000)

  let safeInfo
  if (safeAddress) {
    safeInfo = (
      <div>
        <Address value={safeAddress} ensProvider={mainnetProvider} blockExplorer={blockExplorer} />
        <Balance value={safeBalance} price={price} />

        <div style={{ padding: 8 }}>
          {owners ? (
            <>
              <b>Evaluators:</b>
              <List
                bordered
                loading={initialLoad}
                dataSource={owners}
                renderItem={item => {
                  return (
                    <List.Item key={item + "_ownerEntry"}>
                      <Address address={item} ensProvider={mainnetProvider} fontSize={12} />
                    </List.Item>
                  )
                }}
              />
            </>
          ) : (
            <Spin />
          )}
        </div>
      </div>
    )
  } else {
    safeInfo = (
      <Form layout="vertical">
        <Form.Item label="Evaluators">
          <Input
            placeholder="Enter evaluators separated by ,"
            style={{ marginBottom: 12 }}
            onChange={async e => {
              setSafeNewOwners(e.target.value.split(","))
            }}
          />
        </Form.Item>
        <Form.Item label="Threshold">
          <InputNumber
            placeholder="Enter threshold"
            style={{ width: "100%" }}
            onChange={async number => {
              setNewSafeThreshold(number)
            }}
          />
        </Form.Item>
        <Form.Item>
          <Button
            loading={deploying}
            onClick={async () => {
              setDeploying(true)

              const safeFactory = await SafeFactory.create({ ethAdapter })
              const safeAccountConfig = { owners: newSafeOwners, threshold: newSafeThreshold }
              const safe = await safeFactory.deploySafe(safeAccountConfig)

              setSafeAddress(ethers.utils.getAddress(safe.getAddress()))
              setDeploying(false)

              console.log("SAFE", safe, safe.getAddress())
            }}
            type={"primary"}
          >
            DEPLOY SAFE
          </Button>
        </Form.Item>
        <Form.Item label=" or enter existing address: ">
          <AddressInput
            ensProvider={mainnetProvider}
            onChange={addr => {
              if (ethers.utils.isAddress(addr)) {
                console.log("addr!", addr)

                setSafeAddress(ethers.utils.getAddress(addr))
              }
            }}
          />
        </Form.Item>
      </Form>
    )
  }

  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
        {safeAddress ? (
          <div
            style={{ float: "right", padding: 4, cursor: "pointer", fontSize: 28 }}
            onClick={() => {
              setSafeAddress("")
            }}
          >
            x
          </div>
        ) : (
          ""
        )}

        {safeInfo}
        {safeAddress ? (
          <>
            <h2>Result dependent payment</h2>

            <Divider />
            <Form layout="vertical">
              <Form.Item label="Payout address">
                <AddressInput
                  ensProvider={mainnetProvider}
                  onChange={addr => {
                    if (ethers.utils.isAddress(addr)) {
                      console.log("addr!", addr)
                      setTo(addr)
                    }
                  }}
                />
              </Form.Item>
              <Form.Item label="Amount">
                <EtherInput
                  autofocus
                  price={price}
                  onChange={value => {
                    value = ethers.utils.parseEther(value.toString())
                    setValue(value)
                  }}
                />
              </Form.Item>
              <Form.Item label="Requirement for payment">
                {/* TODO: Give the user a fitting error message when a message of more then 32bytes is entered  */}
                <BytesStringInput
                  autofocus
                  placeholder="Has person X completed task Y?"
                  onChange={value => {
                    setData(value)
                  }}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    const id = await ethAdapter.getChainId()
                    const contractNetworks = {
                      [id]: {
                        multiSendAddress: safeAddress,
                        safeMasterCopyAddress: safeAddress,
                        safeProxyFactoryAddress: safeAddress,
                      },
                    }

                    const safeSdk = await Safe.create({ ethAdapter, safeAddress, contractNetworks })
                    const nonce = await safeSdk.getNonce()
                    const partialTx = {
                      to,
                      data,
                      value: value.toString(),
                      nonce: nonce
                    }

                    const safeTransaction = await safeSdk.createTransaction(partialTx)
                    await safeSdk.signTransaction(safeTransaction)

                    const hash = await safeSdk.getTransactionHash(safeTransaction)
                    await serviceClient.proposeTransaction(
                      safeAddress,
                      safeTransaction.data,
                      hash,
                      safeTransaction.signatures.get(address.toLowerCase()),
                    )
                  }}
                >
                  Sign Transaction
                </Button>
              </Form.Item>
            </Form>
          </>
        ) : (
          <></>
        )}
      </div>
      <div style={{ padding: 64, margin: 64 }}>
        <a href="https://github.com/austintgriffith/scaffold-eth/tree/gnosis-starter-kit" target="_blank">
          🏗
        </a>
      </div>
    </div>
  )
}
