// if you use Windows OS, comment out this:
//const noble = require('@abandonware/noble')({extended: false});
import noble from '@abandonware/noble'

import { LED } from '../mesh.js/packages/block/LED'
const block = new LED()

import { Base } from '../mesh.js/packages/block/Base'
const meshBlock = new Base()
const SERVICE_UUIDS = [meshBlock.UUIDS.SERVICE_ID]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

function command2buf(command: number[]) {
  return Buffer.from(new Uint8Array(command))
}

async function sleep(milliseconds: number) {
  const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time))
  ;(async () => {
    await sleep(milliseconds)
  })()
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
  await noble.startScanningAsync(SERVICE_UUIDS, false).catch(handleError)
  console.log('start scan')

  // Discovered
  noble.on('discover', async (peripheral) => {
    console.log(`discovered: ${peripheral.advertisement.localName}`)

    // Check peripheral
    if (!LED.isMESHblock(peripheral.advertisement.localName)) {
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

    // Send a command to MESH block
    const red = 32
    const green = 64
    const blue = 32
    const totalTime = 30 * 1000
    const onCycle = 2 * 1000
    const offCycle = 1 * 1000
    const pattern = 2 // firefly
    const command = block.createLedCommand(
      {
        red: red,
        green: green,
        blue: blue,
      },
      totalTime,
      onCycle,
      offCycle,
      pattern
    )
    await characteristics[2].writeAsync(command2buf(command), false).catch(handleError)
    await sleep(totalTime)
  })
}

main()
