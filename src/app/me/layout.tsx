export default function MeLayout(props: LayoutProps<'/me'>) {
  return (
    <>
      {props.children}
      {props.plan}
    </>
  )
}
