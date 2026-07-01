import { NavLink } from "react-router-dom";
import PageHeader from "../../components/Shared/PageHeader"
import { FaUserPlus } from "react-icons/fa";
import { useState } from "react";


const Users = () => {

  const [showEditUser, setShowEditUser] = useState(false)
  return (
    <main className="flex flex-col gap-6">
      <div className="flex justify-between  ">
        <PageHeader 
          title={"User Management"} 
          description={'Create accounts and set hierarchy. Commission rates are controlled by Seller Groups, not individual accounts.'}
          icon={FaUserPlus}/>

          <div className="flex gap-2">
            <NavLink to={'seller_group'}>Seller Group</NavLink>
            <button>Create User</button>
          </div>
      </div>
      <div>
        <input type="text" placeholder="Search users or email" />

        <select name="" id="">
          <option value="all_roles">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="broker_network_manager">Broker Network Manager</option>
          <option value="broker">Broker</option>
          <option value="manager">Manager</option>
          <option value="agent">Agent</option>
        </select>

        <select name="" id="">
          <option value="all_status">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="grid grid-cols-6">
        <p>Name</p>
        <p>Role</p>
        <p>Reports Under</p>
        <p>Accreditation Date</p>
        <p>status</p>
        <p>Action</p>
      </div>

      <div className="grid grid-cols-6">
        <div>
          <p>CANTIGA, ROLINDA, C.</p>
          <p>rolinda@gmail.com</p>
        </div>

        <p>Agent</p>

        <div>
          <p>PARROCHO, JOSEPH E.</p>
          <p>Manager</p>
        </div>

        <p>2026-06-28</p>
        <p>Active</p>

        <button onClick={() => {setShowEditUser(true)}}>Edit</button>
        <button>Deactivate</button>
      </div>


      {
        showEditUser && <div>
          <div>
            <h3>Edit User</h3>
            <button onClick={() => {setShowEditUser(false)}}>x</button>
          </div>

          <div>
            <div className="flex justify-between">
              <label className="flex flex-col gap-1 ">
                <p>Full Name</p>
                <input type="text" />
              </label>

              <label className="flex flex-col gap-1 ">
                <p>Email</p>
                <input type="text" />
              </label>
            </div>

            <div className="flex justify-between">
              <label>
                <p>Role</p>
                <select name="" id="">
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="broker_network_manager">Broker Network Manager</option>
                  <option value="broker">Broker</option>
                  <option value="manager">Manager</option>
                  <option value="agent">Agent</option>
                </select>
              </label>

                <label>
                  <select name="" id="">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
            </div>

            <div>
              <label className="flex flex-col gap-1 ">
                <p>Contact No.</p>
                <input type="text" />
              </label>

              <label className="flex flex-col gap-1 ">
                <p>Accreditation Date</p>
                <input type="date" />
              </label>

              <label className="flex flex-col gap-1 ">
                <p>Reports Under</p>
                <input type="date" />
              </label>
            </div>
          </div>
        </div>
      }

    </main>
  )
}

export default Users