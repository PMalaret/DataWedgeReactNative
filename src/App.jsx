/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */
import { useState, useEffect } from 'react'
import { StyleSheet, Text, View, ScrollView, FlatList, TouchableHighlight, DeviceEventEmitter } from 'react-native'
import { CheckBox, Button } from 'react-native-elements'
import DataWedgeIntents from 'react-native-datawedge-intents'

import stylesSheet from './style.js'

const styles = StyleSheet.create(stylesSheet)

const App = () => {
  const [stat, setState] = useState({
    ean8checked: true,
    ean13checked: true,
    code39checked: true,
    code128checked: true,
    lastApiVisible: false,
    lastApiText: 'Messages from DataWedge will go here',
    checkBoxesDisabled: true,
    scanButtonVisible: false,
    dwVersionText: 'Pre 6.3.  Please create and configure profile manually.  See the ReadMe for more details',
    dwVersionTextStyle: styles.itemTextAttention,
    activeProfileText: 'Requires DataWedge 6.3+',
    enumeratedScannersText: 'Requires DataWedge 6.3+',
    scans: []
  })
  const [sendCommandResult, setSendCommandResult] = useState('false')
  const [deviceEmitterSubscription, setDeviceEmitterSubscription] = useState(null)

  useEffect(() => {
    setDeviceEmitterSubscription(DeviceEventEmitter.addListener('datawedge_broadcast_intent', (intent) => { broadcastReceiver(intent) }))
    registerBroadcastReceiver()
    determineVersion()
    return () => {
      deviceEmitterSubscription.remove()
    }
  })

  // componentDidMount()
  // {
  //   setDeviceEmitterSubscription(DeviceEventEmitter.addListener('datawedge_broadcast_intent', (intent) => { broadcastReceiver(intent) }))
  //   registerBroadcastReceiver()
  //   determineVersion()
  // }

  const _onPressScanButton = () => {
    sendCommand('com.symbol.datawedge.api.SOFT_SCAN_TRIGGER', 'TOGGLE_SCANNING')
  }

  const determineVersion = () => {
    sendCommand('com.symbol.datawedge.api.GET_VERSION_INFO', '')
  }

  const setDecoders = () => {
    //  Set the new configuration
    const profileConfig = {
      PROFILE_NAME: 'KoobinProfile',
      PROFILE_ENABLED: 'true',
      CONFIG_MODE: 'UPDATE',
      PLUGIN_CONFIG: {
        PLUGIN_NAME: 'BARCODE',
        PARAM_LIST: {
          // "current-device-id": selectedScannerId,
          scanner_selection: 'auto',
          decoder_ean8: '' + stat.ean8checked,
          decoder_ean13: '' + stat.ean13checked,
          decoder_code128: '' + stat.code128checked,
          decoder_code39: '' + stat.code39checked
        }
      }
    }
    sendCommand('com.symbol.datawedge.api.SET_CONFIG', profileConfig)
  }

  const sendCommand = (extraName, extraValue) => {
    console.log('Sending Command: ' + extraName + ', ' + JSON.stringify(extraValue))
    const broadcastExtras = {}
    broadcastExtras[extraName] = extraValue
    broadcastExtras.SEND_RESULT = sendCommandResult
    DataWedgeIntents.sendBroadcastWithExtras({
      action: 'com.symbol.datawedge.api.ACTION',
      extras: broadcastExtras
    })
  }

  const registerBroadcastReceiver = () => {
    DataWedgeIntents.registerBroadcastReceiver({
      filterActions: [
        'com.zebra.reactnativedemo.ACTION',
        'com.symbol.datawedge.api.RESULT_ACTION'
      ],
      filterCategories: [
        'android.intent.category.DEFAULT'
      ]
    })
  }

  const broadcastReceiver = (intent) => {
    //  Broadcast received
    console.log('Received Intent: ' + JSON.stringify(intent))
    if (intent.hasOwnProperty('RESULT_INFO')) {
      const commandResult = intent.RESULT + ' (' +
            intent.COMMAND.substring(intent.COMMAND.lastIndexOf('.') + 1, intent.COMMAND.length) + ')'// + JSON.stringify(intent.RESULT_INFO);
      commandReceived(commandResult.toLowerCase())
    }

    if (intent.hasOwnProperty('com.symbol.datawedge.api.RESULT_GET_VERSION_INFO')) {
      //  The version has been returned (DW 6.3 or higher).  Includes the DW version along with other subsystem versions e.g MX
      const versionInfo = intent['com.symbol.datawedge.api.RESULT_GET_VERSION_INFO']
      console.log('Version Info: ' + JSON.stringify(versionInfo))
      const datawedgeVersion = versionInfo.DATAWEDGE
      console.log('Datawedge version: ' + datawedgeVersion)

      //  Fire events sequentially so the application can gracefully degrade the functionality available on earlier DW versions
      if (datawedgeVersion >= '06.3') { datawedge63() }
      if (datawedgeVersion >= '06.4') { datawedge64() }
      if (datawedgeVersion >= '06.5') { datawedge65() }

      setState(stat)
    } else if (intent.hasOwnProperty('com.symbol.datawedge.api.RESULT_ENUMERATE_SCANNERS')) {
      //  Return from our request to enumerate the available scanners
      const enumeratedScannersObj = intent['com.symbol.datawedge.api.RESULT_ENUMERATE_SCANNERS']
      enumerateScanners(enumeratedScannersObj)
    } else if (intent.hasOwnProperty('com.symbol.datawedge.api.RESULT_GET_ACTIVE_PROFILE')) {
      //  Return from our request to obtain the active profile
      const activeProfileObj = intent['com.symbol.datawedge.api.RESULT_GET_ACTIVE_PROFILE']
      activeProfile(activeProfileObj)
    } else if (!intent.hasOwnProperty('RESULT_INFO')) {
      //  A barcode has been scanned
      barcodeScanned(intent, new Date().toLocaleString())
    }
  }

  const datawedge63 = () => {
    console.log('Datawedge 6.3 APIs are available')
    //  Create a profile for our application
    sendCommand('com.symbol.datawedge.api.CREATE_PROFILE', 'KoobinProfile')

    stat.dwVersionText = '6.3.  Please configure profile manually.  See ReadMe for more details.'

    //  Although we created the profile we can only configure it with DW 6.4.
    sendCommand('com.symbol.datawedge.api.GET_ACTIVE_PROFILE', '')

    //  Enumerate the available scanners on the device
    sendCommand('com.symbol.datawedge.api.ENUMERATE_SCANNERS', '')

    //  Functionality of the scan button is available
    stat.scanButtonVisible = true

    setState(stat)
  }

  const datawedge64 = () => {
    console.log('Datawedge 6.4 APIs are available')

    //  Documentation states the ability to set a profile config is only available from DW 6.4.
    //  For our purposes, this includes setting the decoders and configuring the associated app / output params of the profile.
    stat.dwVersionText = '6.4.'
    stat.dwVersionTextStyle = styles.itemText
    // document.getElementById('info_datawedgeVersion').classList.remove("attention");

    //  Decoders are now available
    stat.checkBoxesDisabled = false

    setState(stat)

    //  Configure the created profile (associated app and keyboard plugin)
    const profileConfig = {
      PROFILE_NAME: 'KoobinProfile',
      PROFILE_ENABLED: 'true',
      CONFIG_MODE: 'UPDATE',
      PLUGIN_CONFIG: {
        PLUGIN_NAME: 'BARCODE',
        RESET_CONFIG: 'true',
        PARAM_LIST: {}
      },
      APP_LIST: [{
        PACKAGE_NAME: 'com.koobin.datawedgereactnative',
        ACTIVITY_LIST: ['*']
      }]
    }
    sendCommand('com.symbol.datawedge.api.SET_CONFIG', profileConfig)

    //  Configure the created profile (intent plugin)
    const profileConfig2 = {
      PROFILE_NAME: 'KoobinProfile',
      PROFILE_ENABLED: 'true',
      CONFIG_MODE: 'UPDATE',
      PLUGIN_CONFIG: {
        PLUGIN_NAME: 'INTENT',
        RESET_CONFIG: 'true',
        PARAM_LIST: {
          intent_output_enabled: 'true',
          intent_action: 'com.zebra.reactnativedemo.ACTION',
          intent_delivery: '2'
        }
      }
    }
    sendCommand('com.symbol.datawedge.api.SET_CONFIG', profileConfig2)

    //  Give some time for the profile to settle then query its value
    setTimeout(() => {
      sendCommand('com.symbol.datawedge.api.GET_ACTIVE_PROFILE', '')
    }, 1000)
  }

  const datawedge65 = () => {
    console.log('Datawedge 6.5 APIs are available')

    stat.dwVersionText = '6.5 or higher.'

    //  Instruct the API to send
    setSendCommandResult('true')
    stat.lastApiVisible = true
    setState(stat)
  }

  commandReceived(commandText)
  {
    stat.lastApiText = commandText
    setState(stat)
  }

  const enumerateScanners = (enumeratedScanners) => {
    let humanReadableScannerList = ''
    for (let i = 0; i < enumeratedScanners.length; i++) {
      console.log('Scanner found: name= ' + enumeratedScanners[i].SCANNER_NAME + ', id=' + enumeratedScanners[i].SCANNER_INDEX + ', connected=' + enumeratedScanners[i].SCANNER_CONNECTION_STATE)
      humanReadableScannerList += enumeratedScanners[i].SCANNER_NAME
      if (i < enumeratedScanners.length - 1) { humanReadableScannerList += ', ' }
    }
    stat.enumeratedScannersText = humanReadableScannerList

    setState(stat)
  }

  const activeProfile = (theActiveProfile) => {
    stat.activeProfileText = theActiveProfile
    setState(stat)
  }

  const barcodeScanned = (scanData, timeOfScan) => {
    const scannedData = scanData['com.symbol.datawedge.data_string']
    const scannedType = scanData['com.symbol.datawedge.label_type']
    console.log('Scan: ' + scannedData)
    stat.scans.unshift({ data: scannedData, decoder: scannedType, timeAtDecode: timeOfScan })
    console.log(stat.scans)
    setState(stat)
  }

  return (
    <ScrollView>
      <View style={styles.container}>
        <Text style={styles.h1}>Zebra ReactNative DataWedge Demo</Text>
        <Text style={styles.h3}>Information / Configuration</Text>
        <Text style={styles.itemHeading}>DataWedge version:</Text>
        <Text style={stat.dwVersionTextStyle}>{stat.dwVersionText}</Text>
        <Text style={styles.itemHeading}>Active Profile</Text>
        <Text style={styles.itemText}>{stat.activeProfileText}</Text>
        {stat.lastApiVisible &&
          <Text style={styles.itemHeading}>Last API message</Text>}
        {stat.lastApiVisible &&
          <Text style={styles.itemText}>{stat.lastApiText}</Text>}
        <Text style={styles.itemHeading}>Available scanners:</Text>
        <Text style={styles.itemText}>{stat.enumeratedScannersText}</Text>
        <View style={{ flexDirection: 'row', flex: 1 }}>
          <CheckBox
            title='EAN 8'
            checked={stat.ean8checked}
            disabled={stat.checkBoxesDisabled}
            onPress={() => { stat.ean8checked = !stat.ean8checked; setDecoders(); setState(stat) }}
          />
          <CheckBox
            title='EAN 13'
            checked={stat.ean13checked}
            disabled={stat.checkBoxesDisabled}
            onPress={() => { stat.ean13checked = !stat.ean13checked; setDecoders(); setState(stat) }}
          />
        </View>
        <View style={{ flexDirection: 'row', flex: 1 }}>
          <CheckBox
            title='Code 39'
            checked={stat.code39checked}
            disabled={stat.checkBoxesDisabled}
            onPress={() => { stat.code39checked = !stat.code39checked; setDecoders(); setState(stat) }}
          />
          <CheckBox
            title='Code 128'
            checked={stat.code128checked}
            disabled={stat.checkBoxesDisabled}
            onPress={() => { stat.code128checked = !stat.code128checked; setDecoders(); setState(stat) }}
          />
        </View>
        {stat.scanButtonVisible &&
          <Button
            title='Scan'
            color='#333333'
            buttonStyle={{
              backgroundColor: '#ffd200',
              height: 45,
              borderColor: 'transparent',
              borderWidth: 0,
              borderRadius: 5
            }}
            onPress={() => { _onPressScanButton() }}
          />}

        <Text style={styles.itemHeading}>Scanned barcodes will be displayed here:</Text>

        <FlatList
          data={stat.scans}
          extraData={stat}
          keyExtractor={item => item.timeAtDecode}
          renderItem={({ item, separators }) => (
            <TouchableHighlight
              onShowUnderlay={separators.highlight}
              onHideUnderlay={separators.unhighlight}
            >
              <View style={{
                backgroundColor: '#0077A0',
                margin: 10,
                borderRadius: 5
              }}
              >
                <View style={{ flexDirection: 'row', flex: 1 }}>
                  <Text style={styles.scanDataHead}>{item.decoder}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scanDataHeadRight}>{item.timeAtDecode}</Text>
                  </View>
                </View>
                <Text style={styles.scanData}>{item.data}</Text>
              </View>
            </TouchableHighlight>
          )}
        />

      </View>
    </ScrollView>
  )
}

export default App
