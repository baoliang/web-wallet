import { Alert, Form, FormText, ButtonGroup, UncontrolledAlert, Tooltip, CardBlock, CardFooter, Modal, ModalHeader, ModalBody, ModalFooter, ListGroup, ListGroupItem, Badge, Progress, FormGroup, Label, Container, Jumbotron, TabContent, InputGroup, Input, InputGroupAddon, InputGroupButton, Table, TabPane, Nav, NavItem, NavLink, Card, CardSubtitle, Button, CardTitle, CardText, Row, Col } from 'reactstrap';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';

import axios from 'axios'
import React from 'react'
import classnames from 'classnames'
import CopyToClipboard from 'react-copy-to-clipboard'
import bitgoUtxoLib from 'bitgo-utxo-lib';
import btczjs from 'btczjs';
import utils from '../lib/utils'
import hdwallet from '../lib/hdwallet'

import MDRefresh from 'react-icons/lib/md/refresh'
import MDCopy from 'react-icons/lib/md/content-copy'
import MDSettings from 'react-icons/lib/md/settings'
import FARepeat from 'react-icons/lib/fa/repeat'
import FAUnlock from 'react-icons/lib/fa/unlock-alt'
import FAEyeSlash from 'react-icons/lib/fa/eye-slash'
import FAEye from 'react-icons/lib/fa/eye'

// Throttled GET request to prevent unusable lag
const throttledAxiosGet = utils.promiseDebounce(axios.get, 1000, 5)

// Unlock wallet enum
var UNLOCK_WALLET_TYPE = {
  IMPORT_WALLET: 0,
  HD_WALLET: 1,
  PASTE_PRIV_KEY: 2
}

// Components
class ToolTipButton extends React.Component {
  constructor(props){
    super(props);

    this.toggle = this.toggle.bind(this)
    this.state = {
      tooltipOpen: false
    }
  }

  toggle() {
    this.setState({
      tooltipOpen: !this.state.tooltipOpen
    })
  }

  render() {
    return (
      <span>
        <Button disabled={this.props.disabled} onClick={this.props.onClick} className="mr-1" color="secondary" id={'Tooltip-' + this.props.id}>
          {this.props.buttonText}
        </Button>
        <Tooltip placement="top" isOpen={this.state.tooltipOpen} target={'Tooltip-' + this.props.id} toggle={this.toggle}>
          {this.props.tooltipText}
        </Tooltip>
      </span>
    )
  }
}

class ZWalletGenerator extends React.Component {
  constructor(props) {
    super(props)    
    
    this.handlePasswordPhrase = this.handlePasswordPhrase.bind(this);
    this.state = {
      passwordPhrase: '',
      privateKey: ''
    }
  }

  handlePasswordPhrase(e){
    // What wif format do we use?
    var wifHash = this.props.settings.useTestNet ? btczjs.config.testnet.wif : btczjs.config.mainnet.wif

    var pk = btczjs.address.mkPrivKey(e.target.value)
    var pkwif = utils.privKeyToWIF(pk, true, wifHash)

    if (e.target.value === ''){
      pkwif = ''
    }

    this.setState({
      privateKey: pkwif
    })
  }
  
  render () {
    return (
      <div>                  
        <h3 className='display-6'>Generate New Address</h3>
        <br/>
        <InputGroup>          
          <Input onChange={this.handlePasswordPhrase} placeholder="Password phrase. Do NOT forget to save this! Use >15 words to be safe." />            
        </InputGroup>
        <br/>
        <InputGroup>                      
          <Input value={this.state.privateKey} placeholder="Private key generated from password phrase" />              
          <InputGroupButton>
            <CopyToClipboard text={this.state.privateKey}>
              <Button><MDCopy/></Button>
            </CopyToClipboard>
          </InputGroupButton>
        </InputGroup>        
      </div>
    )
  }
}


class ZWalletUnlockKey extends React.Component {
  constructor(props){
    super(props)

    this.unlockHDWallet = this.unlockHDWallet.bind(this)
    this.loadWalletDat = this.loadWalletDat.bind(this)
    this.toggleShowPassword = this.toggleShowPassword.bind(this)
    this.unlockPrivateKeys = this.unlockPrivateKeys.bind(this)    

    this.state = {
      showPassword: false,
      secretPhrase: '',
      invalidPrivateKey: false,
      secretPhraseTooShort: false,      

      // Style for input button
      inputFileStyle: {
          WebkitAppearance: 'button',
          cursor: 'pointer'
      }   
    }
  }  

  toggleShowPassword(){
    this.setState({
      showPassword: !this.state.showPassword
    })
  }

  unlockPrivateKeys(){
    // Success = return 0
    const success = this.props.handleUnlockPrivateKeys() === 0        

    if (!success){
      this.setState({
        invalidPrivateKey: true, 
      })
    }
  }

  unlockHDWallet(){
    try{
      // Generate private keys from secret phrase
      const pk = hdwallet.phraseToHDWallet(this.state.secretPhrase)

      this.setState({
        secretPhraseTooShort: false
      })

      // Set private key and unlock them (we know it'll work so no need to validate)
      this.props.setPrivateKeys(pk, true)
    } catch (err){
      console.error('unlockHDWallet():', { err });
      this.setState({
        secretPhraseTooShort: true
      })
    }
  }

  loadWalletDat(e){    
    var reader = new FileReader()
    var file = e.target.files[0]

    // Read file callback function
    reader.onloadend = () => {
      // Get reader results in bytes
      var dataHexStr = reader.result

      // Retrieve private keys from wallet.dat
      // Source: https://gist.github.com/moocowmoo/a715c80399bb202a65955771c465530c
      var re = /\x30\x81\xD3\x02\x01\x01\x04\x20(.{32})/gm
      var privateKeys = dataHexStr.match(re)
      privateKeys = privateKeys.map(function(x) {
        x = x.replace('\x30\x81\xD3\x02\x01\x01\x04\x20', '')
        x = Buffer.from(x, 'latin1').toString('hex')
        return x
      })      

      // Set private key
      this.props.setPrivateKeys(privateKeys)

      // Unlock private key
      const success = this.props.handleUnlockPrivateKeys() === 0
      
      if (!success){
        this.setState({
          invalidPrivateKey: true, 
        })
      }
    }

    // Read file
    reader.readAsBinaryString(file)
  }

  render () {
    if (this.props.unlockType == UNLOCK_WALLET_TYPE.IMPORT_WALLET){
      return (
        <Form>
          <FormGroup row>            
            <Col>
              {this.state.invalidPrivateKey ? <Alert color="danger"><strong>Error.</strong>&nbsp;Keys in files are corrupted</Alert> : ''}
              <Label for="walletDatFile" className="btn btn-block btn-secondary" style={this.state.inputFileStyle}>Select wallet.dat file
                <Input
                  style={{display: 'none'}}
                  type="file"                 
                  name="file"
                  id="walletDatFile"                
                  onChange={this.loadWalletDat}
                />
              </Label>
              <FormText color="muted">
                For Windows, it should be in %APPDATA%/bitcoinz<br/>
                For Mac/Linux, it should be in ~/.bitcoinz
              </FormText>
            </Col>
          </FormGroup>
        </Form>
      )
    }

    else if (this.props.unlockType == UNLOCK_WALLET_TYPE.PASTE_PRIV_KEY){
      return (
        <div>
          {this.state.invalidPrivateKey ? <Alert color="danger"><strong>Error.</strong>&nbsp;Invalid private key</Alert> : ''}
          <InputGroup>                                       
            <InputGroupButton>
              <ToolTipButton id={4}
                onClick={this.toggleShowPassword}
                buttonText={this.state.showPassword? <FAEye/> : <FAEyeSlash/>}
                tooltipText={this.state.showPassword? 'show password' : 'hide password'}
              />
            </InputGroupButton>
            <Input
              type={this.state.showPassword ? "text" : "password"}
              onChange={(e) => this.props.setPrivateKeys([e.target.value])} // Set it in a list so we can map over it later
              placeholder="Private key"
            />
            <InputGroupButton> 
              <ToolTipButton onClick={this.unlockPrivateKeys} id={3} buttonText={<FAUnlock/>} tooltipText={'unlock'}/>
            </InputGroupButton>
          </InputGroup>
        </div>
      )
    }

    else if (this.props.unlockType == UNLOCK_WALLET_TYPE.HD_WALLET){
      return (
        <div>
          <Alert color="warning"><strong>Warning.</strong>&nbsp;Make sure you have saved your secret phrase somewhere.</Alert>
          {this.state.secretPhraseTooShort ? <Alert color="danger"><strong>Error.</strong>&nbsp;Secret phrase too short</Alert> : '' }
          <InputGroup>                                       
            <InputGroupButton>
              <ToolTipButton id={7}
                onClick={this.toggleShowPassword}
                buttonText={this.state.showPassword? <FAEye/> : <FAEyeSlash/>}
                tooltipText={this.state.showPassword? 'show phrase' : 'hide phrase'}
              />
            </InputGroupButton>
            <Input
              type={this.state.showPassword ? "text" : "password"}
              maxLength="64"
              onChange={(e) => this.setState({secretPhrase: e.target.value})}
              placeholder="Secret phrase. e.g. cash cow money heros cardboard money bag late green"
            />
            <InputGroupButton> 
              <ToolTipButton onClick={this.unlockHDWallet} id={8} buttonText={<FAUnlock/>} tooltipText={'unlock HD wallet'}/>
            </InputGroupButton>
          </InputGroup>
        </div>
      )
    }
  }
}

class ZWalletSettings extends React.Component {
  render () {
    return (
      <Modal isOpen={this.props.settings.showSettings} toggle={this.props.toggleModalSettings}>
        <ModalHeader toggle={this.props.toggleShowSettings}>BitcoinZ Wallet Settings</ModalHeader>                  
        <ModalBody>
          <ZWalletSelectUnlockType
              setUnlockType={this.props.setUnlockType}
              unlockType={this.props.settings.unlockType}
            />  
        </ModalBody>
        <ModalBody>                              
          <InputGroup>
            <InputGroupAddon>Insight API</InputGroupAddon>
            <Input 
              value={this.props.settings.insightAPI}
              onChange={(e) => this.props.setInsightAPI(e.target.value)}
            />
          </InputGroup><br/>
          <Row>
            <Col sm="6">
              <Label check>
                <Input
                  disabled={!(this.props.publicAddresses === null)}
                  defaultChecked={this.props.settings.compressPubKey} type="checkbox" 
                  onChange={this.props.toggleCompressPubKey}
                />{' '}
                Compress Public Key
              </Label>
            </Col>
            <Col sm="6">
              <Label check>
                <Input                                    
                  defaultChecked={this.props.settings.showWalletGen} type="checkbox" 
                  onChange={this.props.toggleShowWalletGen}
                />{' '}
                Show Address Generator
              </Label>
            </Col>
          </Row>
        </ModalBody>        
        <ModalFooter>
          <Label>
            <Input
              disabled={!(this.props.publicAddresses === null)}
              defaultChecked={this.props.settings.useTestNet} type="checkbox" 
              onChange={this.props.toggleUseTestNet}
            />{' '}
            testnet
          </Label>
        </ModalFooter>
      </Modal>
    )
  }
}

class ZAddressInfo extends React.Component {
  constructor(props) {
    super(props)

    this.updateAddressInfo = this.updateAddressInfo.bind(this)
    this.updateAddressesInfo = this.updateAddressesInfo.bind(this)
    

    this.state = {            
      retrieveAddressError: false      
    }
  }

  // Updates all address info
  updateAddressesInfo() {    
    // The key is the address
    // Value is the private key
    Object.keys(this.props.publicAddresses).forEach(function(key) {
      if (key !== undefined){
        this.updateAddressInfo(key)
      }
    }.bind(this))    
  }

  // Updates a address info
  updateAddressInfo(address) {
    // GET request to URL
    var info_url = utils.urlAppend(this.props.settings.insightAPI, 'addr/')
    info_url = utils.urlAppend(info_url, address + '?noTxList=1')    
        
    throttledAxiosGet(info_url)
    .then(function (response){
      var data = response.data;

      this.props.setPublicAddressesKeyValue(address, 'confirmedBalance', data.balance)
      this.props.setPublicAddressesKeyValue(address, 'unconfirmedBalance', data.unconfirmedBalance)
      this.setState({
        retrieveAddressError: false
      })

    }.bind(this))
    .catch(function (err){
      console.error('updateAddressInfo()', { address, err });
      this.setState({
        retrieveAddressError: true
      })
    }.bind(this))
  }

  componentDidMount() {
    // Run immediately
    this.updateAddressesInfo()

    // Update every 30 seconds    
    this.interval = setInterval(this.updateAddressesInfo, 300000)
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  render() {   
    // Key is the address
    var addresses = [];
    var totalConfirmed = 0.0;
    var totalUnconfirmed = 0.0;
    Object.keys(this.props.publicAddresses).forEach(function(key) {
      if (key !== undefined){
        // Add to address    
        addresses.push(
          {
            address: {
              address: key,
              transactionURL: this.props.publicAddresses[key].transactionURL
            },
            privateKeyWIF: this.props.publicAddresses[key].privateKeyWIF,
            confirmedBalance: this.props.publicAddresses[key].confirmedBalance,
            unconfirmedBalance: this.props.publicAddresses[key].unconfirmedBalance
          }
        )

        const c_confirmed = Number(this.props.publicAddresses[key].confirmedBalance)
        const c_unconfirmed = Number(this.props.publicAddresses[key].unconfirmedBalance)
        if (!isNaN(c_confirmed)){
          totalConfirmed += c_confirmed
        }

        if (!isNaN(c_unconfirmed)){
          totalUnconfirmed += c_unconfirmed
        }
      }
    }.bind(this))  

    // <tr>
    //   <th scope="row"><a href={this.props.publicAddresses[key].transactionURL}>{key}</a></th>
    //   <td>
        // <CopyToClipboard text={this.props.publicAddresses[key].privateKeyWIF}>
        //   <ToolTipButton id={key} buttonText={<MDCopy/>} tooltipText={'copy wif private key'}/>                
        // </CopyToClipboard>
    //   </td>
    //   <td>{this.props.publicAddresses[key].confirmedBalance}</td>
    //   <td>{this.props.publicAddresses[key].unconfirmedBalance}</td>                      
    // </tr>
    
    // Functions to format data in table
    function tableAddressFormatter(cell, row) {
      return '<a href="' + cell.transactionURL + '">' + cell.address + '</a>'
    }

    function tableWIFFormatter(cell, row) {
      return (
        <CopyToClipboard text={cell}>
          <ToolTipButton id={cell} buttonText={<MDCopy/>} tooltipText={'copy wif private key'}/>                
        </CopyToClipboard>
      )
    }

    return (
      <Row>
        <Col>     
          <Card>
            <CardBlock>                                  
              {this.state.retrieveAddressError ?
              <Alert color="danger">Error connecting to the Insight API. Double check the Insight API supplied in settings.</Alert>
              :
              <Alert color="warning">The balance displayed here is dependent on the insight node.<br/>Automatically updates every 5 minutes.</Alert>
              }                
              <ToolTipButton onClick={this.updateAddressesInfo} id={5} buttonText={<MDRefresh/>} tooltipText={'manually refresh balance'}/>                                 
            </CardBlock>
          </Card>
          <Card>
            <CardBlock>
              <BootstrapTable data={[{totalConfirmed: totalConfirmed, totalUnconfirmed: totalUnconfirmed}]} striped hover> 
                <TableHeaderColumn isKey={true} dataField='totalConfirmed'>Total Confirmed</TableHeaderColumn>
                <TableHeaderColumn dataField='totalUnconfirmed'>Total Unconfirmed</TableHeaderColumn>                                    
              </BootstrapTable>
            </CardBlock>
          </Card>          
          <Card>
            <CardBlock>                                            
              <BootstrapTable data={addresses} striped hover>
                <TableHeaderColumn isKey dataField='address' dataFormat={tableAddressFormatter} width='60%'>Address</TableHeaderColumn>
                <TableHeaderColumn dataField='privateKeyWIF' dataFormat={tableWIFFormatter}>WIF</TableHeaderColumn>
                <TableHeaderColumn dataField='confirmedBalance'>Confirmed</TableHeaderColumn>
                <TableHeaderColumn dataField='unconfirmedBalance'>Unconfirmed</TableHeaderColumn>
              </BootstrapTable>                                                       
            </CardBlock>
          </Card>
        </Col>
      </Row>
    )
  }
}

class ZSend extends React.Component {
  constructor(props) {
    super(props)    
    
    this.setProgressValue = this.setProgressValue.bind(this);
    this.setSendErrorMessage = this.setSendErrorMessage.bind(this);    
    this.handleUpdateSelectedAddress = this.handleUpdateSelectedAddress.bind(this);
    this.handleUpdateRecipientAddress = this.handleUpdateRecipientAddress.bind(this);
    this.handleUpdateAmount = this.handleUpdateAmount.bind(this);
    this.handleCheckChanged = this.handleCheckChanged.bind(this);
    this.handleUpdateFee = this.handleUpdateFee.bind(this);
    this.handleSend = this.handleSend.bind(this);    

    this.state = {
      selectedAddress: '', // which address did we select
      recipientAddress: '',
      fee: '',
      amount: '',                        
      sentTxid: '', // Whats the send txid
      sendProgress: 0, // Progress bar, 100 to indicate complete
      sendErrorMessage: '',
      confirmSend: false,
    }
  }
  
  handleUpdateSelectedAddress(e) {    
    this.setState({
      selectedAddress: e.target.value
    })
  }

  handleUpdateRecipientAddress(e) {
    this.setState({
      recipientAddress: e.target.value
    })
  }

  handleUpdateFee(e) {
    this.setState({
      fee: e.target.value
    })
  }

  handleUpdateAmount(e) {    
    this.setState({
      amount: e.target.value
    })
  }

  handleCheckChanged(e){    
    this.setState({
      confirmSend: e.target.checked
    })
  }

  setProgressValue(v){
    this.setState({
      sendProgress: v
    })
  }

  setSendErrorMessage(msg){
    this.setState({
      sendErrorMessage: msg
    })
  }

  handleSend(){      
    const value = this.state.amount;
    const fee = this.state.fee;
    const recipientAddress = this.state.recipientAddress;
    const senderAddress = this.state.selectedAddress;

    // Convert how much we wanna send
    // to satoshis
    const satoshisToSend = Math.round(value * 100000000)
    const satoshisfeesToSend = Math.round(fee * 100000000)        
    
    // Reset send progress and error message
    this.setProgressValue(1)
    this.setSendErrorMessage('')

    // Error strings
    var errString = ''

    // Validation    
    if (senderAddress === ''){
      errString += '`From Address` field can\'t be empty.;'
    }

    if (recipientAddress.length !== 35) {
      errString += 'Invalid address. Only transparent addresses are supported at this point in time.;'
    }

    if (typeof parseInt(value) !== 'number' || value === ''){
      errString += 'Invalid amount.;'
    }

    // Can't send 0 satoshis
    if (satoshisToSend <= 0){
      errString += 'Amount must be greater than 0.;'      
    }

    if (typeof parseInt(fee) !== 'number' || fee === ''){
      errString += 'Invalid fee.;'
    }

    if (errString !== ''){
      this.setSendErrorMessage(errString)
      this.setProgressValue(0)
      return
    }

    // Private key
    const senderPrivateKeyWIF = this.props.publicAddresses[senderAddress].privateKeyWIF;

    // Get previous transactions
    const prevTxURL = utils.urlAppend(this.props.settings.insightAPI, 'addr/') + senderAddress + '/utxo'
    const infoURL = utils.urlAppend(this.props.settings.insightAPI, 'status?q=getInfo')
    const sendRawTxURL = utils.urlAppend(this.props.settings.insightAPI, 'tx/send')

    // Building our transaction TXOBJ
    // How many satoshis do we have so far
    var satoshisSoFar = 0
    var history = []
    var recipients = [{address: recipientAddress, satoshis: satoshisToSend}]

    // Get transactions and info
    axios.get(prevTxURL)
    .then(function (tx_resp){
      this.setProgressValue(25)
      
      const tx_data = tx_resp.data      

      axios.get(infoURL)
      .then(function (info_resp){
        this.setProgressValue(50)
        const infoData = info_resp.data

        const blockHeight = infoData.info.blocks - 300
        const blockHashURL = utils.urlAppend(this.props.settings.insightAPI, 'block-index/') + blockHeight        

        // Get block hash
        axios.get(blockHashURL)
        .then(function(response_bhash){
          this.setProgressValue(75)
          
          const blockHash = response_bhash.data.blockHash

          // Iterate through each utxo
          // append it to history
          for (var i = 0; i < tx_data.length; i ++){
            if (tx_data[i].confirmations == 0){
              continue;
            }

            history = history.concat({
              txid: tx_data[i].txid,
              vout: tx_data[i].vout,
              satoshis: tx_data[i].satoshis,
              scriptPubKey: tx_data[i].scriptPubKey,            
            });
            
            // How many satoshis do we have so far
            satoshisSoFar = satoshisSoFar + tx_data[i].satoshis;
            if (satoshisSoFar >= satoshisToSend + satoshisfeesToSend){
              break;
            }
          }

          // If we don't have enough address
          // fail and tell user
          if (satoshisSoFar < satoshisToSend + satoshisfeesToSend){            
            this.setSendErrorMessage('Not enough confirmed BTCZ in account to perform transaction')
            this.setProgressValue(0)          
          }

          // If we don't have exact amount
          // Refund remaining to current address
          if (satoshisSoFar !== satoshisToSend + satoshisfeesToSend){
            var refundSatoshis = satoshisSoFar - satoshisToSend - satoshisfeesToSend
            // Refunding 'dust' (<54 satoshis will result in unconfirmed txs)
            if (refundSatoshis > 60){
              recipients = recipients.concat({address: senderAddress, satoshis: refundSatoshis})
            }
          }

          // Start building transaction
          const networkName = this.props.settings.useTestNet ? 'bitcoinzTest' : 'bitcoinz'
          let network = bitgoUtxoLib.networks[networkName]

          var keyPair = bitgoUtxoLib.ECPair.fromWIF(senderPrivateKeyWIF,network)
          var txb = new bitgoUtxoLib.TransactionBuilder(network)

          txb.setVersion(bitgoUtxoLib.Transaction.ZCASH_SAPLING_VERSION)
          txb.setVersionGroupId(0x892F2085)
          txb.setExpiryHeight(infoData.info.blocks+300) // expiration set to 300 blocks

          // add inputs
          for (var j = 0; j < history.length; j++) {
            txb.addInput(history[j].txid, history[j].vout)
          }

          // add outputs
          for (var k = 0; k < recipients.length; k++) {
            var outputScript = bitgoUtxoLib.address.toOutputScript(recipients[k].address,network)
            txb.addOutput(outputScript, recipients[k].satoshis)
          }

          // Sign each history transcation
          for (var l = 0; l < history.length; l++) {
            txb.sign(l,keyPair,'',bitgoUtxoLib.Transaction.SIGHASH_SINGLE,history[l].satoshis,'')
          }

          // Convert it to hex string
          const txHexString = txb.build().toHex()

          // Post it to the api
          axios.post(sendRawTxURL, { rawtx: txHexString }, {
              headers: { 'Content-Type': 'application/json' }
            })
            .then((sendtxResp) => {
              const txRespData = sendtxResp.data

              this.setState({
                sendProgress: 100,
                sentTxid: txRespData.txid
              })
            })

            .catch((err) => {
              console.error('Error sending RawTxURL: ', { sendRawTxURL, err })
              this.setSendErrorMessage(err + '')
              this.setProgressValue(0)
              return
            });
        }.bind(this))
      }.bind(this))
    }.bind(this))
    .catch(function(error){      
      console.error('Error getting prevTxURL: ', { prevTxURL, err })
      this.setSendErrorMessage(error)
      this.setProgressValue(0)
      return
    }.bind(this));
  } 

  render() {
    // If send was successful
    var zTxLink
    if (this.state.sendProgress === 100){
      var ztx = utils.urlAppend(this.props.settings.explorerURL, 'tx/') + this.state.sentTxid
      zTxLink = (
        <Alert color="success">
        <strong>BTCZ successfully sent!</strong> <a href={ztx}>Click here to view your transaction</a>
        </Alert>
      )      
    }

    // Else show error why
    else if (this.state.sendErrorMessage !== ''){
      zTxLink = (
        this.state.sendErrorMessage.split(';').map(function (s) {
          if (s !== ''){
            return (
              <Alert color="danger">
              <strong>Error.</strong> {s}
              </Alert>
            )
          }
        })
      )      
    }

    // Send addresses
    // Key is the address btw
    var sendAddresses = [];
    Object.keys(this.props.publicAddresses).forEach(function(key) {
      if (key !== undefined){        
        sendAddresses.push(
          <option value={key}>[{this.props.publicAddresses[key].confirmedBalance}] - {key}</option>                                       
        )
      }
    }.bind(this))

    return (
      <Row>
        <Col>
          <Card>
            <CardBlock>       
              <Alert color="danger">ALWAYS VALIDATE YOUR DESINATION ADDRESS BY SENDING SMALL AMOUNTS OF BTCZ FIRST</Alert>              
              <InputGroup>
                <InputGroupAddon>From Address</InputGroupAddon>
                <Input type="select" onChange={this.handleUpdateSelectedAddress}>
                  <option value=''></option>
                  {sendAddresses}
                </Input>
              </InputGroup>
              <InputGroup>
                <InputGroupAddon>To Address</InputGroupAddon>
                <Input onChange={this.handleUpdateRecipientAddress} placeholder="e.g t1fHHnAXxoPWGY77sG5Zw2sFfGUTpW6BcSZ" />
              </InputGroup>
              <InputGroup>
                <InputGroupAddon>Amount</InputGroupAddon>
                <Input onChange={this.handleUpdateAmount} placeholder="e.g 42" />
              </InputGroup>
              <InputGroup>
                <InputGroupAddon>Fee</InputGroupAddon>
                <Input onChange={this.handleUpdateFee} placeholder="e.g 0.001" />
              </InputGroup>
              <br/>
              <FormGroup check>
                <Label check>
                  <Input onChange={this.handleCheckChanged} type="checkbox" />{' '}
                  Yes, I would like to send these BTCZ
                </Label>
              </FormGroup> 
              <br/>                           
              <Button 
                color="warning" className="btn-block"
                disabled={!this.state.confirmSend || (this.state.sendProgress > 0 && this.state.sendProgress < 100)}
                onClick={this.handleSend}
              >Send</Button>
            </CardBlock>
            <CardFooter> 
              {zTxLink}
              <Progress value={this.state.sendProgress} />                                  
            </CardFooter>       
          </Card>
        </Col>
      </Row>
    )
  }
}

class ZWalletSelectUnlockType extends React.Component {
  constructor(props) {
    super(props);

    this.state = { cSelected: this.props.unlockType }
  }

  onRadioBtnClick(s){
    this.setState({
      cSelected: s
    })

    this.props.setUnlockType(s)
  }

  render() {
    return ( 
      <div style={{textAlign: 'center'}}>  
        <ButtonGroup vertical>                 
          <Button color="secondary" onClick={() => this.onRadioBtnClick(UNLOCK_WALLET_TYPE.HD_WALLET)} active={this.state.cSelected === UNLOCK_WALLET_TYPE.HD_WALLET}>Enter secret phrase</Button>
          <Button color="secondary" onClick={() => this.onRadioBtnClick(UNLOCK_WALLET_TYPE.IMPORT_WALLET)} active={this.state.cSelected === UNLOCK_WALLET_TYPE.IMPORT_WALLET}>Load wallet.dat</Button>        
          <Button color="secondary" onClick={() => this.onRadioBtnClick(UNLOCK_WALLET_TYPE.PASTE_PRIV_KEY)} active={this.state.cSelected === UNLOCK_WALLET_TYPE.PASTE_PRIV_KEY}>Paste private key</Button>      
        </ButtonGroup>
      </div>
    )
  }
}

class ZWalletTabs extends React.Component {
  constructor(props){
    super(props)

    this.toggleTabs = this.toggleTabs.bind(this);
    this.state = {
      activeTab: '1'
    }
  }

  toggleTabs(tab) {
    if (this.state.activeTab !== tab) {
      this.setState({
        activeTab: tab
      });
    }
  }

  render () {
    return (      
      <div>
        <Nav tabs>
          <NavItem>
            <NavLink
              className={classnames({ active: this.state.activeTab === '1' })}
              onClick={() => { this.toggleTabs('1'); }}
            >
              Info
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={classnames({ active: this.state.activeTab === '2' })}
              onClick={() => { this.toggleTabs('2'); }}
            >
              Send BTCZ
            </NavLink>
          </NavItem>         
        </Nav>
        <TabContent activeTab={this.state.activeTab}>
          <TabPane tabId="1">
            <ZAddressInfo
              publicAddresses={this.props.publicAddresses}
              settings={this.props.settings}
              setPublicAddressesKeyValue={this.props.setPublicAddressesKeyValue}
            />
          </TabPane>
          <TabPane tabId="2">
            <ZSend 
              settings={this.props.settings}
              publicAddresses={this.props.publicAddresses}            
            />
          </TabPane>  
        </TabContent>
      </div>       
    )
  }
}

export default class ZWallet extends React.Component {
  constructor(props) {
    super(props);

    this.resetKeys = this.resetKeys.bind(this)
    this.handleUnlockPrivateKeys = this.handleUnlockPrivateKeys.bind(this)
    this.setPrivateKeys = this.setPrivateKeys.bind(this)        
    this.setInsightAPI = this.setInsightAPI.bind(this)
    this.setUnlockType = this.setUnlockType.bind(this)
    this.setPublicAddressesKeyValue = this.setPublicAddressesKeyValue.bind(this)
    this.toggleUseTestNet = this.toggleUseTestNet.bind(this)
    this.toggleCompressPubKey = this.toggleCompressPubKey.bind(this)
    this.toggleShowSettings = this.toggleShowSettings.bind(this)
    this.toggleShowWalletGen = this.toggleShowWalletGen.bind(this)     

    this.state = {
      privateKeys : '',
      publicAddresses: null, // Public address will be {address: {privateKey: '', transactionURL: '', privateKeyWIF: ''}
      settings: {
        showSettings: false,
        showWalletGen: false,
        compressPubKey: true,
        insightAPI: 'https://explorer.btcz.rocks/api/',
        explorerURL: 'https://explorer.btcz.rocks/',
        useTestNet: false,
        unlockType: UNLOCK_WALLET_TYPE.HD_WALLET
      }
    };    
  }  

  handleUnlockPrivateKeys(){    
    if (this.state.privateKeys.length === 0){
      return -2
    }

    //try{
      var publicAddresses = {}

      function _privKeyToAddr(pk, compressPubKey, useTestNet){
        // If not 64 length, probs WIF format
        if (pk.length !== 64){
          pk = utils.WIFToPrivKey(pk)          
        }

        // Convert public key to public address
        const pubKey = btczjs.address.privKeyToPubKey(pk, compressPubKey)

        // Testnet or nah
        const pubKeyHash = useTestNet ? btczjs.config.testnet.pubKeyHash : btczjs.config.mainnet.pubKeyHash
        const publicAddr = btczjs.address.pubKeyToAddr(pubKey, pubKeyHash)

        return publicAddr
      }

      for (var i = 0; i < this.state.privateKeys.length; i++){
        const pubKeyHashWif = this.state.settings.useTestNet ? btczjs.config.testnet.wif : btczjs.config.mainnet.wif
        
        var c_pk_wif;
        var c_pk = this.state.privateKeys[i]

        // If not 64 length, probs WIF format
        if (c_pk.length !== 64){
          c_pk_wif = c_pk
          c_pk = utils.WIFToPrivKey(c_pk)
        }
        else{
          c_pk_wif = utils.privKeyToWIF(c_pk)
        }          

        var c_pk_wif = utils.privKeyToWIF(c_pk, true, pubKeyHashWif)        
        const c_addr = _privKeyToAddr(c_pk, this.state.settings.compressPubKey, this.state.settings.useTestNet)        

        publicAddresses[c_addr] = {
          privateKey: c_pk,
          privateKeyWIF: c_pk_wif,
          transactionURL: utils.urlAppend(this.state.settings.explorerURL, 'address/') + c_addr,        
          confirmedBalance: 'loading...',
          unconfirmedBalance: 'loading...',  
        }
      }      

      // Set public address
      this.setPublicAddresses(publicAddresses)

      // Return success
      return 0
    //} catch(err) {      
    //  console.error('handleUnlockPrivateKeys()', { err });
    //  this.setPublicAddresses(null)
    //  return -1
    //}
  }

  resetKeys(){
    this.setState({
      privateKeys : '',
      publicAddresses: null,
    })
  }

  // Only used for bip32 gen wallet because
  // of the async nature
  setPrivateKeys(pk, handleUnlockingKeys){
    if (handleUnlockingKeys === undefined){
      handleUnlockingKeys = false
    }
    this.setState({
      privateKeys: pk
    }, handleUnlockingKeys ? this.handleUnlockPrivateKeys : undefined)
  }

  setPublicAddresses(pa){
    this.setState({
      publicAddresses: pa
    })
  }

  setPublicAddressesKeyValue(address, key, value){
    var newPublicAddresses = this.state.publicAddresses
    newPublicAddresses[address][key] = value

    this.setState({
      publicAddresses: newPublicAddresses
    })
  }

  setInsightAPI(uri){    
    var _settings = this.state.settings
    _settings.insightAPI = uri

    this.setState({
      _settings: _settings
    })
  }  

  setUnlockType(t){
    var _settings = this.state.settings
    _settings.unlockType = t

    this.setState({
      _settings: _settings
    })
  }

  toggleCompressPubKey(b){
    var _settings = this.state.settings
    _settings.compressPubKey = !_settings.compressPubKey    

    this.setState({
      _settings: _settings
    })
  }

  toggleUseTestNet(){
    var _settings = this.state.settings
    _settings.useTestNet = !_settings.useTestNet

    if (_settings.useTestNet){
      _settings.insightAPI = 'http://testnet.explorer.btcz.life:3002/api/'
      _settings.explorerURL = 'http://testnet.explorer.btcz.life:3002/'
    }
    else{
      _settings.insightAPI = 'https://explorer.btcz.rocks/api/'
      _settings.explorerURL = 'https://explorer.btcz.rocks/'
    }

    this.setState({
      settings: _settings
    })    
  }

  toggleShowSettings(){
    var _settings = this.state.settings
    _settings.showSettings = !_settings.showSettings

    this.setState({
      settings: _settings
    })
  }

  toggleShowWalletGen(){
    var _settings = this.state.settings
    _settings.showWalletGen = !_settings.showWalletGen

    this.setState({
      settings: _settings
    })
  }

  render() {        
    return (
      <Container>
        <Row>
          <Col>
            <h1 className='display-6'>BitcoinZ Wallet&nbsp;
              <ToolTipButton onClick={this.toggleShowSettings} id={1} buttonText={<MDSettings/>} tooltipText={'settings'}/>&nbsp;
              <ToolTipButton disabled={this.state.publicAddresses === null} onClick={this.resetKeys} id={2} buttonText={<FARepeat/>} tooltipText={'reset wallet'}/>
            </h1>
            <ZWalletSettings 
              setUnlockType={this.setUnlockType}              
              toggleShowSettings={this.toggleShowSettings}
              toggleCompressPubKey={this.toggleCompressPubKey}           
              toggleShowWalletGen={this.toggleShowWalletGen}
              toggleUseTestNet={this.toggleUseTestNet}              
              setInsightAPI={this.setInsightAPI}
              settings={this.state.settings}
              publicAddresses={this.state.publicAddresses}
            />
            <br/>
          </Col>
        </Row>
        <Row>
          <Col>
            { this.state.publicAddresses === null ?
              (                                              
                <ZWalletUnlockKey
                handleUnlockPrivateKeys={this.handleUnlockPrivateKeys}
                setPrivateKeys={this.setPrivateKeys}
                unlockType={this.state.settings.unlockType}
                />                
              )
              :
              (<ZWalletTabs
                publicAddresses={this.state.publicAddresses}
                settings={this.state.settings}
                setPublicAddressesKeyValue={this.setPublicAddressesKeyValue}
                privateKeys={this.state.privateKeys}
              />)
            }
          </Col>
        </Row>
        <Row>
          <Col>
            { this.state.settings.showWalletGen ?
              (<div><br/><hr/><ZWalletGenerator settings={this.state.settings}/></div>) : null
            }
          </Col>
        </Row>
      </Container>
    );
  }
}