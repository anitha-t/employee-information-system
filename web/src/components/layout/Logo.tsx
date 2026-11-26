import logoMark from '../../assets/logo-mark.png'
import logo from '../../assets/logo.png'

const NAME = 'Employee Information'

/**
 * The brand logo. The full artwork has navy lettering that disappears on a dark
 * background, so dark mode shows the icon with the name set as text in the page colour.
 */
export function Logo({ size = 'medium' }: { size?: 'medium' | 'large' }) {
  return (
    <span className={`logo logo-${size}`}>
      <img className="logo-light" src={logo} alt={NAME} />
      <span className="logo-dark">
        <img src={logoMark} alt="" />
        <span>{NAME}</span>
      </span>
    </span>
  )
}
