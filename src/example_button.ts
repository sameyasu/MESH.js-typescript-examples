import noble from '@abandonware/noble'

import { Button } from '../mesh.js/packages/block/Button'
const block = new Button()

import { Base } from '../mesh.js/packages/block/Base'
const meshBlock = new Base()
const SERVICE_UUIDS = [meshBlock.UUIDS.SERVICE_ID]

function handleError(err: any) {
  console.log(err)
}

async function discoverCharacteristics(peripheral: noble.Peripheral) {
  const services = (await peripheral
    .discoverServicesAsync(SERVICE_UUIDS)
    .catch(handleError)) as noble.Service[]
  const tmpChara = (await services[0]
    .discoverCharacteristicsAsync(Object.values(meshBlock.UUIDS.CHARACTERISTICS))
    .catch(handleError)) as noble.Characteristic[]
  // sort to fix random order of characteristic
  const characteristics = tmpChara.sort(function (a, b) {
    return a.properties[0].toLowerCase() < b.properties[0].toLowerCase() ? -1 : 1
  })
  return characteristics
}

function command2buf(command: any) {
  return Buffer.from(command, 'hex')
}

async function setupBlock(characteristics: noble.Characteristic[]) {
  // Subscribe indicate
  await characteristics[0].subscribeAsync()
  characteristics[0].on('data', async function (data, isNotification) {
    block.indicate([...data])
    void isNotification
  })

  // Subscribe notify
  await characteristics[1].subscribeAsync()
  characteristics[1].on('data', async function (data, isNotification) {
    block.notify([...data])
    void isNotification
  })

  // Send activation command of MESH block functions
  await characteristics[2]
    .writeAsync(command2buf(meshBlock.featureCommand), false)
    .catch(handleError)
  console.log('ready')
}

async function main() {
  // Start scanning
  console.log('start scan')
  await noble.startScanningAsync(SERVICE_UUIDS, false).catch(handleError)
  console.log('end scan')

  // Discovered
  noble.on('discover', async (peripheral) => {
    console.log(`discovered: ${peripheral.advertisement.localName}`)

    // Check peripheral
    if (!Button.isMESHblock(peripheral.advertisement.localName)) {
      return
    }

    // Stop scanning when target block discovered
    await noble.stopScanningAsync().catch(handleError)

    // Connect to the device
    await peripheral.connectAsync().catch(handleError)
    console.log(`connected: ${peripheral.advertisement.localName}`)

    // Discover characteristics
    const characteristics = await discoverCharacteristics(peripheral)

    // Setup MESH block with initial communication
    await setupBlock(characteristics)

    // Event handler
    block.onSinglePressed = () => {
      console.log('Single Pressed')
    }
    block.onLongPressed = () => {
      console.log('Long Pressed')
    }
    block.onDoublePressed = () => {
      console.log('Double Pressed')
    }
  })
}

main()
