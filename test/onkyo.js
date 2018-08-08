// 3rd party modules
const _ = require('lodash');
const sinon = require('sinon');
const {expect} = require('chai');
const Promise = require('bluebird');
// module under test
const {Onkyo, OnkyoError} = require('../lib');

const {stub, spy} = sinon;


describe('Onkyo', function () {
  describe('eiscpPacketExtract', function () {
    it('raises', function () {
      expect(() => Onkyo.eiscpPacketExtract('')).to.throw(OnkyoError);
      expect(() => Onkyo.eiscpPacketExtract('asd')).to.throw(OnkyoError);
      expect(() => Onkyo.eiscpPacketExtract('000000')).to.throw(OnkyoError);
    });
    it('pass', function () {
      expect(Onkyo.eiscpPacketExtract('abc\x0d')).to.be.eql('abc');
      expect(Onkyo.eiscpPacketExtract('abc\x1a')).to.be.eql('abc');
      expect(Onkyo.eiscpPacketExtract('abc\x1a\x0d')).to.be.eql('abc');
      expect(Onkyo.eiscpPacketExtract('abc\x1a\x0d\x0a')).to.be.eql('abc');
    });
  });
  describe('constructor', function () {
    const validate = (onkyo, obj) => {
      expect(onkyo).to.be.instanceof(Onkyo);
      if (obj) {
        if (obj.name) {
          expect(onkyo.name).to.be.equal(obj.name);
        }
        if (obj.address) {
          expect(onkyo.address).to.be.equal(obj.address);
        }
        if (obj.port) {
          expect(onkyo.port).to.be.equal(obj.port);
        }
      }
    };
    const test = (obj) => {
      const onkyo = new Onkyo(obj);
      validate(onkyo);
    };
    const options = {
      'with address': {address: '1.2.3.4'},
      'with logger': {
        logger: new Proxy({}, {get: () => () => {}}),
        address: '1.2.3.4'
      },
      'with name': {name: 'test', address: '1.2.3.4'},
      'with port': {port: 1, address: '1.2.3.4'}
    };
    it('raises', function () {
      expect(() => new Onkyo()).to.throw(Error);
      expect(() => new Onkyo({})).to.throw(Error);
      expect(() => new Onkyo({logger: {}})).to.throw(Error);
      expect(() => new Onkyo({port: 123})).to.throw(Error);
      expect(() => new Onkyo({port: 123})).to.throw(Error);
      expect(() => Onkyo.init()).to.throw(Error);
    });
    _.each(options, (opt, key) => {
      it(key, function () {
        test(opt);
      });
    });
    it('init', function () {
      const onkyo = Onkyo.init({address: 'localhost'});
      validate(onkyo);
    });
  });
  let socket;
  let onEvents;
  const customConnect = (host, cb) => {
    cb();
    return socket;
  };
  beforeEach(function () {
    onEvents = {};
    socket = {
      on: stub(),
      end: stub(),
      write: stub()
    };
    socket.on.callsFake((event, cb) => {
      onEvents[event] = cb;
    });
  });
  it('connect', function () {
    const onkyo = new Onkyo({address: 'localhost'});
    const myConnect = (host, cb) => {
      expect(host).to.be.deep.eql({
        host: 'localhost',
        port: Onkyo.DEFAULT_PORT
      });
      return customConnect(host, cb);
    };
    return onkyo.connect(myConnect)
      .then(() => {
        expect(socket.on.callCount).to.be.equal(3);
      });
  });
  describe('receive', function () {
    let onkyo;
    beforeEach(function () {
      onkyo = new Onkyo({address: 'localhost'});
      return onkyo
        .connect(customConnect);
    });
    const tests = [
      {
        rx: '!1PWR00',
        event: 'PWR',
        payload: {PWR: false}
      },
      {
        rx: '!1PWR01',
        event: 'PWR',
        payload: {PWR: true}
      },
      {
        rx: '!1AMT01',
        event: 'AMT',
        payload: {AMT: true}
      },
      {
        rx: '!1AMT00',
        event: 'AMT',
        payload: {AMT: false}
      }
    ];
    _.each(tests, (obj) => {
      it(obj.rx, function () {
        return new Promise((resolve) => {
          onkyo.on(obj.event, resolve);
          onEvents.data(Onkyo.createEiscpBuffer(`${obj.rx}\x1a`));
        })
          .then((data) => {
            expect(data).to.be.deep.eql(obj.payload);
          });
      });
    });
    it('unrecognize', function (done) {
      spy(onkyo, '_parseMsg');
      onEvents.data(Onkyo.createEiscpBuffer('abc01\x1a'));
      onkyo.once('error', () => {
        expect(onkyo._parseMsg.calledOnce).to.be.eql(true);
        onkyo._parseMsg.restore();
        done();
      });
    });
  });
  it('sendCommand', function () {
    const onkyo = new Onkyo({address: 'localhost'});
    return onkyo
      .connect(customConnect)
      .then(() => {
        const fakeData = onEvents.data;
        const response = Onkyo.createEiscpBuffer('!1PWR00\x1a');
        return Promise.all([
          onkyo.sendCommand('POWER', 'ON'),
          Promise.delay(1).then(() => fakeData(response))
        ]);
      })
      .then(() => {
        expect(socket.write.callCount).to.be.equal(1);
      });
  });
  describe('api', function () {
    let onkyo;
    beforeEach(function () {
      onkyo = new Onkyo({address: 'localhost'});
      return onkyo
        .connect(customConnect);
    });
    // @TODO more test..
  });
});