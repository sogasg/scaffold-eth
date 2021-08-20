import React, { useState, useEffect } from "react"
import { Typography, Form, Button, List, Divider } from "antd"
import { ethers } from "ethers"
import SafeServiceClient from "@gnosis.pm/safe-service-client"
import Safe, { EthersAdapter } from "@gnosis.pm/safe-core-sdk"
import { usePoller, useLocalStorage } from "../hooks"
import { EthSignSignature } from "./EthSignSignature"
import { Address, AddressInput } from "../components"

export default function EvaluatorView({ mainnetProvider, userSigner, address, blockExplorer }) {
  const serviceClient = new SafeServiceClient("https://safe-transaction.rinkeby.gnosis.io/")

  const [safeAddress, setSafeAddress] = useLocalStorage("deployedSafe")
  const [ethAdapter, setEthAdapter] = useState()
  const [transactions, setTransactions] = useState([])
  const [owners, setOwners] = useState([])
  const [currentThreshold, setCurrentThreshold] = useState([])
  const [threshold, setThreshold] = useState(0)
  const [initialLoad, setInitialLoad] = useState(true)

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
          console.log("owners=" + owners)
          setOwners(owners)
          setThreshold(threshold)
          setInitialLoad(false)
        }
        console.log("CHECKING TRANSACTIONS....", safeAddress)
        const transactions = await serviceClient.getPendingTransactions(safeAddress)
        console.log(transactions)
        setTransactions(transactions.results)
        const currentThreshold = []
        for (let i = 0; i < transactions.results.length; i++) {
          const signers = []
          currentThreshold.push(transactions.results[i].confirmations.length)
          for (let j = 0; j < transactions.results[i].confirmations.length; j++) {
            signers.push(transactions.results[i].confirmations[j].owner)
          }
          transactions.results[i].signers = signers
        }

        setCurrentThreshold(currentThreshold)
      } catch (e) {
        console.log("ERROR POLLING TRANSACTIONS FROM SAFE:", e)
      }
    }
  }, 15000)

  return (
    <div style={{ border: "1px solid #cccccc", padding: 16, width: 400, margin: "auto", marginTop: 64 }}>
      {safeAddress ? (
        <>
          <div
            style={{ float: "right", padding: 4, cursor: "pointer", fontSize: 28 }}
            onClick={() => {
              setSafeAddress("")
            }}
          >
            x
          </div>
          <Address value={safeAddress} ensProvider={mainnetProvider} blockExplorer={blockExplorer} />
          <div style={{ margin: 8 }}>
            <Typography.Title level={4}>Active clams</Typography.Title>
            <Divider />
            <List
              itemLayout="vertical"
              loading={initialLoad}
              dataSource={transactions.map((transaction, index) => ({ ...transaction, arrayIndex: index }))}
              renderItem={transaction => {
                return (
                  <List.Item
                    actions={[
                      <>
                        {owners !== undefined &&
                          transaction.signers !== undefined &&
                          owners.includes(address) &&
                          !transaction.signers.includes(address) &&
                          currentThreshold[transaction.arrayIndex] < threshold && (
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
                                const hash = transaction.safeTxHash
                                const signature = await safeSdk.signTransactionHash(hash)
                                await serviceClient.confirmTransaction(hash, signature.data)
                              }}
                            >
                              I verify that this statement is true
                            </Button>
                          )}
                        {owners !== undefined &&
                          owners.includes(address) &&
                          currentThreshold[transaction.arrayIndex] >= threshold && (
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
                                const safeSdk2 = await safeSdk.connect({ ethAdapter, safeAddress })
                                console.log(transaction)

                                const safeTransactionData = {
                                  to: transaction.to,
                                  value: transaction.value,
                                  data: transaction.data || "0x",
                                  operation: transaction.operation,
                                  safeTxGas: transaction.safeTxGas,
                                  baseGas: transaction.baseGas,
                                  gasPrice: Number(transaction.gasPrice),
                                  gasToken: transaction.gasToken,
                                  refundReceiver: transaction.refundReceiver,
                                  nonce: transaction.nonce,
                                }
                                const safeTransaction = await safeSdk.createTransaction(safeTransactionData)
                                if (transaction.confirmations) {
                                  for (let i = 0; i < transaction.confirmations?.length; i++) {
                                    const confirmation = transaction.confirmations[i]
                                    const signature = new EthSignSignature(confirmation.owner, confirmation.signature)
                                    await safeTransaction.addSignature(signature)
                                  }
                                }
                                const executeTxResponse = await safeSdk2.executeTransaction(safeTransaction)
                                const receipt =
                                  executeTxResponse.transactionResponse &&
                                  (await executeTxResponse.transactionResponse.wait())
                                console.log(receipt)
                              }}
                            >
                              Execute
                            </Button>
                          )}
                      </>,
                    ]}
                  >
                    {ethers.utils.parseBytes32String(transaction.data)}
                  </List.Item>
                )
              }}
            />
          </div>
        </>
      ) : (
        <Form layout="vertical">
          <Form.Item label="Safe Address">
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
      )}
    </div>
  )
}
