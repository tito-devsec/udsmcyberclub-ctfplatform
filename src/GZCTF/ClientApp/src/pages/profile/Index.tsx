import { FC } from 'react'
import { Navigate } from 'react-router'
import { WithRole } from '@Components/WithRole'
import { RangePage } from '@Components/range/RangePage'
import { profileUrl } from '@Utils/Community'
import { useUser } from '@Hooks/useUser'
import { Role } from '@Api'

// "My profile": sends a signed-in student to their own profile page.
const MyProfile: FC = () => {
  const { user } = useUser()

  return (
    <WithRole requiredRole={Role.User}>
      {user?.userName ? <Navigate to={profileUrl(user.userName)} replace /> : <RangePage isLoading />}
    </WithRole>
  )
}

export default MyProfile
