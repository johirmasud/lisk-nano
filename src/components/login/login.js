import React from 'react';
import grid from 'flexboxgrid/dist/flexboxgrid.css';
import Input from 'react-toolbox/lib/input';
import Dropdown from 'react-toolbox/lib/dropdown';
import Button from 'react-toolbox/lib/button';
import Checkbox from 'react-toolbox/lib/checkbox';
import { isValidPassphrase } from '../../utils/passphrase';
import { findSimilarWord, inDictionary } from '../../utils/similarWord';
import networksRaw from './networks';
import Passphrase from '../passphrase';
import styles from './login.css';
import env from '../../constants/env';

/**
 * The container component containing login
 * and create account functionality
 */
class Login extends React.Component {
  constructor() {
    super();

    this.networks = networksRaw.map((network, index) => ({
      label: network.name,
      value: index,
    }));

    this.state = {
      passphrase: '',
      address: '',
      network: 0,
    };

    this.validators = {
      address: this.validateUrl,
      passphrase: this.validatePassphrase.bind(this),
    };
  }

  componentDidMount() {
    this.autologin();
    // pre-fill passphrase and address if exiting in cookies
    this.devPreFill();
  }

  componentDidUpdate() {
    if (this.props.account && this.props.account.address) {
      this.props.history.replace(this.getReferrerRoute());
      if (this.state.address) {
        localStorage.setItem('address', this.state.address);
      }
      localStorage.setItem('network', this.state.network);
    }
  }

  getReferrerRoute() {
    const { isDelegate } = this.props.account;
    const { search } = this.props.history.location;
    const transactionRoute = '/main/transactions';
    const referrerRoute = search.indexOf('?referrer') === 0 ? search.replace('?referrer=', '') : transactionRoute;
    if (!isDelegate && referrerRoute === '/main/forging') {
      return transactionRoute;
    }
    return referrerRoute;
  }

  // eslint-disable-next-line class-methods-use-this
  validateUrl(value) {
    const addHttp = (url) => {
      const reg = /^(?:f|ht)tps?:\/\//i;
      return reg.test(url) ? url : `http://${url}`;
    };

    const errorMessage = 'URL is invalid';

    const isValidLocalhost = url => url.hostname === 'localhost' && url.port.length > 1;
    const isValidRemote = url => /(([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3})/.test(url.hostname);

    let addressValidity = '';
    try {
      const url = new URL(addHttp(value));
      addressValidity = url && (isValidRemote(url) || isValidLocalhost(url)) ? '' : errorMessage;
    } catch (e) {
      addressValidity = errorMessage;
    }

    const data = { address: value, addressValidity };
    return data;
  }

  validatePassphrase(value) {
    const data = { passphrase: value };
    data.passphraseValidity = !isValidPassphrase(value) ? this.getPassphraseValidationError(value) : '';
    return data;
  }

  // eslint-disable-next-line class-methods-use-this
  getPassphraseValidationError(passphrase) {
    if (!passphrase) {
      return 'Empty passphrase';
    }
    const mnemonic = passphrase.trim().toLowerCase().split(' ');
    if (mnemonic.length < 12) {
      return `Passphrase should have 12 words, entered passphrase has ${mnemonic.length}`;
    }

    const invalidWord = mnemonic.find(word => !inDictionary(word));
    if (invalidWord) {
      if (invalidWord.length >= 2 && invalidWord.length <= 8) {
        const validWord = findSimilarWord(invalidWord);
        if (validWord) {
          return `Word "${invalidWord}" is not on the passphrase Word List. Most similar word on the list is "${findSimilarWord(invalidWord)}"`;
        }
      }
      return `Word "${invalidWord}" is not on the passphrase Word List.`;
    }
    return 'Passphrase is not valid';
  }

  changeHandler(name, value) {
    const validator = this.validators[name] || (() => ({}));
    this.setState({
      [name]: value,
      ...validator(value),
    });
  }

  autologin() {
    const savedAccounts = localStorage.getItem('accounts');
    if (savedAccounts && !this.props.account.afterLogout) {
      const account = JSON.parse(savedAccounts)[0];
      const network = Object.assign({}, networksRaw[account.network]);
      if (account.network === 2) {
        network.address = account.address;
      }

      // set active peer
      this.props.activePeerSet({
        publicKey: account.publicKey,
        network,
      });
    }
  }

  onLoginSubmission(passphrase) {
    const network = Object.assign({}, networksRaw[this.state.network]);
    if (this.state.network === 2) {
      network.address = this.state.address;
    }

    // set active peer
    this.props.activePeerSet({
      passphrase,
      network,
    });
  }

  devPreFill() {
    const address = localStorage.getItem('address') || '';
    const passphrase = localStorage.getItem('passphrase') || '';
    const network = parseInt(localStorage.getItem('network'), 10) || 0;

    this.setState({
      network,
      ...this.validators.address(address),
      ...this.validators.passphrase(passphrase),
    });

    // ignore this in coverage as it is hard to test and does not run in production
    /* istanbul ignore if */
    if (!env.production && localStorage.getItem('autologin') && !this.props.account.afterLogout && passphrase) {
      setTimeout(() => {
        this.onLoginSubmission(passphrase);
      });
    }
  }

  render() {
    return (
      <div className={`box ${styles.wrapper}`}>
        <div className={`${grid.row} ${grid['center-xs']}`}>
          <div className={`${grid['col-xs-12']} ${grid['col-sm-8']}`}>
            <form>
              <Dropdown
                auto={false}
                source={this.networks}
                onChange={this.changeHandler.bind(this, 'network')}
                label='Select a network'
                value={this.state.network}
                className={`${styles.network} network`}
              />
              {
                this.state.network === 2 &&
                  <Input type='text'
                    label='Node address'
                    name='address'
                    className='address'
                    theme={styles}
                    value={this.state.address}
                    error={this.state.addressValidity}
                    onChange={this.changeHandler.bind(this, 'address')} />
              }
              <Input type={this.state.showPassphrase ? 'text' : 'password'}
                label='Enter your passphrase' name='passphrase'
                className='passphrase'
                theme={styles}
                error={this.state.passphraseValidity === 'Empty passphrase' ? '' : this.state.passphraseValidity}
                value={this.state.passphrase}
                onChange={this.changeHandler.bind(this, 'passphrase')} />
              <Checkbox
                checked={this.state.showPassphrase}
                label="Show passphrase"
                className={`${grid['start-xs']} show-passphrase`}
                theme={styles}
                onChange={this.changeHandler.bind(this, 'showPassphrase')}
              />
              <footer className={ `${grid.row} ${grid['center-xs']}` }>
                <div className={grid['col-xs-12']}>
                  <Button label='NEW ACCOUNT' flat primary
                    className={`${styles.newAccount} new-account-button`}
                    onClick={() => this.props.setActiveDialog({
                      title: 'New Account',
                      childComponent: Passphrase,
                      childComponentProps: {
                        onPassGenerated: this.onLoginSubmission.bind(this),
                      },
                    })} />
                  <Button label='LOGIN' primary raised
                    onClick={this.onLoginSubmission.bind(this, this.state.passphrase)}
                    className='login-button'
                    disabled={(this.state.network === 2 && this.state.addressValidity !== '') ||
                    this.state.passphraseValidity !== ''} />
                </div>
              </footer>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

export default Login;
